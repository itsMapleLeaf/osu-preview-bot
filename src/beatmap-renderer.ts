import type { CanvasRenderingContext2D } from "canvas"
import type { Beatmap } from "./download-beatmaps"
import { lerpClamped } from "./helpers/math"

type Tween = {
  start: number
  end: number
  render: (context: CanvasRenderingContext2D, progress: number) => void
}

const tweens: Tween[] = [
  // fade in
  {
    start: -0.5,
    end: 0,
    render: (context: CanvasRenderingContext2D, progress: number) => {
      context.globalAlpha = progress
    },
  },
  // quick fade out and scale up
  {
    start: 0,
    end: 0.1,
    render: (context: CanvasRenderingContext2D, progress: number) => {
      const scale = lerpClamped(1, 1.2, progress)
      context.globalAlpha = 1 - progress
      context.scale(scale, scale)
    },
  },
]

export function createBeatmapRenderer(beatmap: Beatmap) {
  const hitObjects = [...beatmap.hitObjects].sort(
    (a, b) => a.startTime - b.startTime,
  )

  return function renderView(
    timeSeconds: number,
    context: CanvasRenderingContext2D,
  ) {
    context.fillStyle = "black"
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)

    context.fillStyle = "cornflowerblue"

    for (const object of hitObjects) {
      const startTimeSeconds = object.startTime / 1000
      const relativeTimeSeconds = timeSeconds - startTimeSeconds

      const currentTween = tweens.find(
        (tween) =>
          relativeTimeSeconds >= tween.start &&
          relativeTimeSeconds <= tween.end,
      )

      if (!currentTween) continue

      const tweenProgress =
        (relativeTimeSeconds - currentTween.start) /
        (currentTween.end - currentTween.start)

      context.save()
      context.translate(object.startX, object.startY)

      currentTween.render(context, tweenProgress)

      context.beginPath()
      context.arc(0, 0, 32, 0, 2 * Math.PI)
      context.fill()

      context.restore()
    }
  }
}
