import type { CanvasRenderingContext2D } from "canvas"
import type { Beatmap, HitObject } from "osu-classes"
import { SlidableObject } from "osu-parsers"
import { clamp, lerpClamped } from "../helpers/math"

type Animation = {
  start: number
  end: number
  render: (context: CanvasRenderingContext2D, progress: number) => void
}

function createAnimations(object: HitObject): Animation[] {
  const circleDiameter = 64
  const animations: Animation[] = []

  if (object instanceof SlidableObject) {
    const renderSlider = (
      context: CanvasRenderingContext2D,
      animationProgress: number,
    ) => {
      // todo: prerender this
      context.strokeStyle = "cornflowerblue"
      context.lineWidth = circleDiameter
      context.lineCap = "round"
      context.lineJoin = "round"

      context.beginPath()

      const finalPosition = object.path.positionAt(1)
      context.moveTo(finalPosition.x, finalPosition.y)

      for (
        let sliderProgress = object.duration;
        sliderProgress > object.duration * animationProgress;
        sliderProgress -= 10
      ) {
        const { x, y } = object.path.positionAt(
          clamp(sliderProgress / object.duration, 0, 1),
        )
        context.lineTo(x, y)
      }

      if (animationProgress === 0) {
        const startPosition = object.path.positionAt(0)
        context.lineTo(startPosition.x, startPosition.y)
      }

      context.stroke()
    }

    animations.push(
      {
        start: -0.5,
        end: 0,
        render: (context, progress) => {
          context.globalAlpha = progress
          renderSlider(context, 0)
        },
      },
      {
        start: 0,
        end: object.duration / 1000,
        render: (context, progress) => {
          renderSlider(context, progress)
        },
      },
    )
  }

  animations.push(
    {
      start: -0.5,
      end: 0,
      render: (context, progress) => {
        context.globalAlpha = progress
        context.fillStyle = "cornflowerblue"

        context.beginPath()
        context.arc(0, 0, circleDiameter / 2, 0, 2 * Math.PI)
        context.fill()
      },
    },

    // approach circle
    // {
    //   start: -0.42,
    //   end: 0,
    //   render: (context, progress) => {
    //     const approachCircleScale = lerpClamped(4, 1, progress)
    //     context.scale(approachCircleScale, approachCircleScale)
    //     context.strokeStyle = "cornflowerblue"
    //     context.lineWidth = 3
    //     context.globalAlpha = progress
    //     context.beginPath()
    //     context.arc(0, 0, circleDiameter, 0, 2 * Math.PI)
    //     context.stroke()
    //   },
    // },

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
        context.arc(0, 0, circleDiameter / 2, 0, 2 * Math.PI)
        context.fill()
      },
    },
  )

  return animations
}

export function createBeatmapRenderer(beatmap: Beatmap) {
  const entries = [...beatmap.hitObjects]
    .sort((a, b) => a.startTime - b.startTime)
    .map((object) => ({
      object,
      animations: createAnimations(object),
    }))

  return function renderView(
    timeSeconds: number,
    context: CanvasRenderingContext2D,
  ) {
    context.fillStyle = "black"
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)

    for (const { object, animations } of entries) {
      const startTimeSeconds = object.startTime / 1000
      const relativeTimeSeconds = timeSeconds - startTimeSeconds

      const currentAnimations = animations.filter(
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
