import type { CanvasRenderingContext2D } from "canvas"
import type { HittableObject } from "osu-parsers"
import type { Beatmap } from "./download-beatmaps"
import { lerpClamped } from "./helpers/math"

type Animations = {
  start: number
  end: number
  render: (context: CanvasRenderingContext2D, progress: number) => void
}

const animations = (object: HittableObject): Animations[] => [
  // circle fading in
  {
    start: -0.5,
    end: 0,
    render: (context, progress) => {
      context.globalAlpha = progress
      context.fillStyle = "cornflowerblue"

      context.beginPath()
      context.arc(0, 0, 32, 0, 2 * Math.PI)
      context.fill()
    },
  },

  // approach circle
  {
    start: -0.42,
    end: 0,
    render: (context, progress) => {
      const approachCircleScale = lerpClamped(4, 1, progress)

      context.scale(approachCircleScale, approachCircleScale)

      context.strokeStyle = "cornflowerblue"
      context.lineWidth = 3
      context.globalAlpha = progress

      context.beginPath()
      context.arc(0, 0, 32, 0, 2 * Math.PI)
      context.stroke()
    },
  },

  // hit explosion
  {
    start: 0,
    end: 0.1,
    render: (context, progress) => {
      const scale = lerpClamped(1, 1.5, progress)
      context.scale(scale, scale)

      context.fillStyle = "cornflowerblue"
      context.globalAlpha = 1 - progress

      context.beginPath()
      context.arc(0, 0, 32, 0, 2 * Math.PI)
      context.fill()
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

    for (const object of hitObjects) {
      const startTimeSeconds = object.startTime / 1000
      const relativeTimeSeconds = timeSeconds - startTimeSeconds

      const currentAnimations = animations(object).filter(
        (tween) =>
          relativeTimeSeconds >= tween.start && relativeTimeSeconds < tween.end,
      )

      for (const animation of currentAnimations) {
        const progress =
          (relativeTimeSeconds - animation.start) /
          (animation.end - animation.start)

        context.save()

        // shrink everything from the center
        context.translate(context.canvas.width / 2, context.canvas.height / 2)
        context.scale(0.85, 0.85)
        context.translate(context.canvas.width / -2, context.canvas.height / -2)

        // translate to the hit object's position
        context.translate(object.startX, object.startY)

        animation.render(context, progress)

        context.restore()
      }
    }
  }
}
