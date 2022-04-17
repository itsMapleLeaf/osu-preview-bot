import type { CanvasRenderingContext2D } from "canvas"
import { Canvas } from "canvas"
import { execa } from "execa"
import pathToFfmpeg from "ffmpeg-static"
import { once } from "node:events"
import { rm } from "node:fs/promises"
import { PassThrough } from "node:stream"
import { pipeline } from "node:stream/promises"

type RenderVideoOptions = {
  signal: AbortSignal
  durationSeconds: number
  audio: Buffer
  renderView: (timeSeconds: number, context: CanvasRenderingContext2D) => void
}

const resolution = [640, 480] as const
const framesPerSecond = 60

export async function renderVideo(options: RenderVideoOptions) {
  const videoOutputPath = `data/output-${Date.now()}.video.mp4`
  const outputPath = `data/output.mp4`

  const videoArgs = [
    // input options
    "-f rawvideo",
    `-video_size ${resolution[0]}x${resolution[1]}`,
    `-framerate ${framesPerSecond}`,
    "-pix_fmt bgra",
    "-i -",

    // output options
    "-movflags faststart", // need this to add audio later
    videoOutputPath,
  ].flatMap((s) => s.split(/\s+/))

  const audioArgs = [
    "-y",

    // audio input from buffer
    "-f mp3",
    "-i -",

    // video input from file
    `-i ${videoOutputPath}`,

    // output options
    outputPath,
  ].flatMap((s) => s.split(/\s+/))

  try {
    const videoProcess = execa(pathToFfmpeg, videoArgs, {
      stderr: "inherit",
      signal: options.signal,
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

    await execa(pathToFfmpeg, audioArgs, {
      input: options.audio,
      stderr: "inherit",
      signal: options.signal,
    })

    return outputPath
  } finally {
    await rm(videoOutputPath, { force: true })
  }
}
