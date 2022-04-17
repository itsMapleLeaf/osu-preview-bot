import { BeatmapSet } from "./beatmap-set"
import { renderVideo } from "./render-video"
import { createBeatmapRenderer } from "./view-renderer"

const beatmapSetId = "647383"
const beatmapId = "1377665"
const beatmapIndex = 2

console.log("downloading beatmapset")
const set = await BeatmapSet.fromBeatmapSetId(beatmapSetId)
const map = set.getBeatmapById(beatmapId)
// const map = set.getBeatmapByIndex(beatmapIndex)
const audio = await set.loadBeatmapAudio(map)

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
