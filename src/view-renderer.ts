import type { CanvasRenderingContext2D } from "canvas"
import type { Beatmap } from "./download-beatmaps"
import { lerp } from "./math"

const hitObjectDuration = 0.15

export function createBeatmapRenderer(beatmap: Beatmap) {
  return function renderView(
    timeSeconds: number,
    context: CanvasRenderingContext2D,
  ) {
    context.fillStyle = "black"
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)

    context.fillStyle = "cornflowerblue"

    for (const hitObject of beatmap.hitObjects) {
      const startTimeSeconds = hitObject.startTime / 1000
      if (startTimeSeconds >= timeSeconds) {
        continue
      }

      if (startTimeSeconds + hitObjectDuration < timeSeconds) {
        continue
      }

      context.globalAlpha = lerp(
        1,
        0,
        (timeSeconds - startTimeSeconds) / hitObjectDuration,
      )
      context.beginPath()
      context.arc(hitObject.startX, hitObject.startY, 32, 0, 2 * Math.PI)
      context.fill()
    }
  }
}
