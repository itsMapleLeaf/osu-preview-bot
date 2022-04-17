import type { CanvasRenderingContext2D } from "canvas"
import { Canvas } from "canvas"
import { execa } from "execa"
import pathToFfmpeg from "ffmpeg-static"
import { rm } from "node:fs/promises"

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
    "-f png_pipe",
    `-r ${framesPerSecond}`,
    "-i -",

    // output options
    "-codec:v libx265",
    "-preset ultrafast",
    "-pix_fmt yuv420p", // allows playback in some video players like vlc
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

    const canvas = new Canvas(...resolution)
    const context = canvas.getContext("2d")

    for (
      let frame = 0;
      frame < options.durationSeconds * framesPerSecond;
      frame += 1
    ) {
      options.renderView(frame / framesPerSecond, context)
      videoProcess.stdin!.write(canvas.toBuffer("image/png"))
    }
    videoProcess.stdin!.end()

    await videoProcess

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
