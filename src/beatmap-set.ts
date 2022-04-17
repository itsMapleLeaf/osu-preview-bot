import got from "got"
import JSZip from "jszip"
import { writeFile } from "node:fs/promises"
import { BeatmapDecoder } from "osu-parsers"

export type Beatmap = ReturnType<BeatmapDecoder["decodeFromString"]>

const decoder = new BeatmapDecoder()

export class BeatmapSet {
  private constructor(
    private readonly beatmaps: Beatmap[],
    private readonly zipFile: JSZip,
  ) {}

  static async fromBeatmapSetId(beatmapSetId: string): Promise<BeatmapSet> {
    const buffer = await got(`https://chimu.moe/d/${beatmapSetId}`).buffer()
    await writeFile("data/beatmap.zip", buffer)

    const zip = await JSZip.loadAsync(buffer)

    const maps = await Promise.all(
      Object.values(zip.files)
        .filter((file) => file.name.endsWith(".osu"))
        .map(async (file) => {
          const content = await file.async("string")
          return decoder.decodeFromString(content)
        }),
    )

    return new BeatmapSet(maps, zip)
  }

  getBeatmapById(beatmapId: string) {
    const beatmap = this.beatmaps.find(
      (beatmap) => String(beatmap.metadata.beatmapId) === beatmapId,
    )
    return beatmap ?? this.throwBeatmapNotFoundError(beatmapId)
  }

  getBeatmapByIndex(index: number) {
    return this.beatmaps[index] ?? this.throwBeatmapNotFoundError(index)
  }

  loadBeatmapAudio(beatmap: Beatmap): Promise<Buffer> {
    const audioFile = this.zipFile.file(beatmap.general.audioFilename)
    if (!audioFile) {
      throw new Error(`Audio file not found: ${beatmap.general.audioFilename}`)
    }

    return audioFile.async("nodebuffer")
  }

  private throwBeatmapNotFoundError(beatmapId: string | number): never {
    const errorMessage = [
      `Beatmap not found: ${beatmapId}`,
      ``,
      `Available beatmaps:`,
      ...this.beatmaps.map(
        (beatmap) =>
          `${beatmap.metadata.beatmapId}: ${beatmap.metadata.version}`,
      ),
    ].join("\n")

    throw new Error(errorMessage)
  }
}
