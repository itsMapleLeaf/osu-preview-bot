import type { CanvasRenderingContext2D } from "canvas"
import { Canvas } from "canvas"
import { execa } from "execa"
import pathToFfmpeg from "ffmpeg-static"
import { once } from "node:events"
import { rm } from "node:fs/promises"
import { PassThrough } from "node:stream"
import { pipeline } from "node:stream/promises"

type RenderVideoOptions = {
  signal?: AbortSignal
  durationSeconds: number
  audio: Buffer
  renderView: (timeSeconds: number, context: CanvasRenderingContext2D) => void
}

const resolution = [640, 480] as const
const framesPerSecond = 60

const targetFileSizeBytes = 1024 * 1024 * 8

export async function renderVideo(options: RenderVideoOptions) {
  const videoOutputPath = `data/output-${Date.now()}.video.mp4`
  const outputPath = `data/output-${Date.now()}.mp4`

  const targetTotalKbps = floorToNearest(
    ((targetFileSizeBytes * 8) / 1024 / options.durationSeconds) * 0.9,
    8,
  )

  const targetAudioKbps = Math.min(128, targetTotalKbps * 0.5)

  const videoArgs = [
    // input options
    "-f rawvideo",
    `-video_size ${resolution[0]}x${resolution[1]}`,
    `-framerate ${framesPerSecond}`,
    "-pix_fmt bgra",
    `-t ${options.durationSeconds}`,
    "-i -",

    // output options
    "-c:v libx264",
    "-movflags faststart", // need this to add audio later
    videoOutputPath,
  ].flatMap((s) => s.split(/\s+/))

  const audioArgs = [
    // audio input from buffer
    "-f mp3",
    `-t ${options.durationSeconds}`,
    "-i -",

    // video input from file
    `-t ${options.durationSeconds}`,
    `-i ${videoOutputPath}`,

    // output options
    `-fs ${Math.floor(targetFileSizeBytes - 1024 * 1024 * 0.1)}`, // hard maximum file size

    "-c:v libx264",
    `-b:v ${targetTotalKbps - targetAudioKbps}k`,
    `-bufsize:v ${targetTotalKbps - targetAudioKbps}k`,
    "-pix_fmt yuv420p", // allows playback on some video players & discord

    "-c:a aac",
    `-b:a ${targetAudioKbps}k`,
    `-bufsize:a ${targetTotalKbps - targetAudioKbps}k`,

    outputPath,
  ].flatMap((s) => s.split(/\s+/))

  try {
    const videoProcess = execa(pathToFfmpeg, videoArgs, {
      signal: options.signal,
      stderr: "inherit",
    })

    const frameStream = new PassThrough({
      highWaterMark: 1024 ** 2,
    })

    const framePipeline = pipeline([frameStream, videoProcess.stdin!])

    const canvas = new Canvas(...resolution)
    const context = canvas.getContext("2d")

    for (
      let frame = 0;
      frame < options.durationSeconds * framesPerSecond;
      frame += 1
    ) {
      options.renderView(frame / framesPerSecond, context)

      const canContinueWriting = frameStream.write(canvas.toBuffer("raw"))
      if (!canContinueWriting) {
        await once(frameStream, "drain")
      }
    }
    frameStream.end()

    await Promise.all([framePipeline, videoProcess])

    try {
    await execa(pathToFfmpeg, audioArgs, {
      input: options.audio,
      signal: options.signal,
      stderr: "inherit",
    })
    } catch (error: any) {
      if (error?.code === "EPIPE") {
        // ffmpeg has closed the pipe, so we can safely ignore this error
        // and just assume the video was written successfully
      } else {
        throw error
      }
    }

    return outputPath
  } finally {
    await rm(videoOutputPath, { force: true })
  }
}

function floorToNearest(value: number, step: number) {
  return Math.floor(value / step) * step
}
