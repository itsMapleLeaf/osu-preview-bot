import AdmZip from "adm-zip"
import got from "got"
import { BeatmapDecoder } from "osu-parsers"

export type Beatmap = ReturnType<BeatmapDecoder["decodeFromString"]>

const decoder = new BeatmapDecoder()

export class BeatmapSet {
  private constructor(
    private readonly beatmaps: Beatmap[],
    private readonly zipFile: AdmZip,
  ) {}

  static async fromBeatmapSetId(beatmapSetId: string): Promise<BeatmapSet> {
    const buffer = await got(`https://chimu.moe/d/${beatmapSetId}`).buffer()
    const zip = new AdmZip(buffer)

    zip.writeZip("data/beatmap.zip")

    const entries = zip.getEntries()
    const maps = entries
      .filter((entry) => entry.entryName.endsWith(".osu"))
      .map((entry) => entry.getData().toString("utf8"))
      .map((content) => decoder.decodeFromString(content))

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

  loadBeatmapAudio(beatmap: Beatmap): Buffer {
    const audioFile = this.zipFile.getEntry(beatmap.general.audioFilename)
    if (!audioFile) {
      throw new Error(`Audio file not found: ${beatmap.general.audioFilename}`)
    }

    return audioFile.getData()
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
