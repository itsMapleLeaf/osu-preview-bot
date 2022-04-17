export function lerp(a: number, b: number, delta: number) {
  return a + (b - a) * delta
}

export function clamp(value: number, min: number, max: number) {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function lerpClamped(a: number, b: number, delta: number) {
  return lerp(a, b, clamp(delta, 0, 1))
}
