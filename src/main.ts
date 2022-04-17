import { BeatmapSet } from "./beatmap-set"
import { renderVideo } from "./render-video"
import { createBeatmapRenderer } from "./view-renderer"

const beatmapSetId = "132586"
const beatmapId = "352863"
const beatmapIndex = 2

console.log("downloading beatmapset")
const set = await BeatmapSet.fromBeatmapSetId(beatmapSetId)
const map = set.getBeatmapById(beatmapId)
// const map = set.getBeatmapByIndex(beatmapIndex)
const audio = set.loadBeatmapAudio(map)

const abortController = new AbortController()

process.on("SIGINT", () => {
  console.log("aborting")
  abortController.abort()
})

console.log("rendering video")
await renderVideo({
  audio,
  signal: abortController.signal,
  durationSeconds: map.totalLength / 1000,
  renderView: createBeatmapRenderer(map),
})
console.log("done")
