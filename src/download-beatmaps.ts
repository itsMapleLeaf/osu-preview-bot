import AdmZip from "adm-zip"
import got from "got"
import type { Beatmap } from "osu-classes"
import { BeatmapDecoder } from "osu-parsers"
import prettyBytes from "pretty-bytes"

export async function downloadBeatmaps(
  beatmapSetId: string,
): Promise<Beatmap[]> {
  const buffer = await got(`https://chimu.moe/d/${beatmapSetId}`).buffer()
  console.info(prettyBytes(buffer.length))

  const zip = new AdmZip(buffer)
  const decoder = new BeatmapDecoder()

  return zip
    .getEntries()
    .filter((entry) => entry.entryName.endsWith(".osu"))
    .map((entry) => entry.getData().toString("utf8"))
    .map((content) => decoder.decodeFromString(content))
}
