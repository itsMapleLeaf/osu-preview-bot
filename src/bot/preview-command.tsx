import { readFile, rm, stat } from "node:fs/promises"
import prettyBytes from "pretty-bytes"
import type { ReacordDiscordJs } from "reacord"
import { Button, Option, Select } from "reacord"
import * as React from "react"
import { raise } from "../helpers/errors"
import { createBeatmapRenderer } from "../osu/beatmap-renderer"
import { BeatmapSet } from "../osu/beatmap-set"
import { renderVideo } from "../video/render-video"
import type { Command } from "./commands"

export function createPreviewCommand(reacord: ReacordDiscordJs): Command {
  return {
    name: "preview",
    description: "Create a preview video for a beatmap",
    options: [
      {
        name: "beatmap_url",
        description:
          "The url of the beatmap (ex: osu.ppy.sh/beatmapsets/12345)",
        type: "STRING",
        required: true,
      },
    ],
    run: async (interaction) => {
      const beatmapSetUrl = interaction.options.getString("beatmap_url", true)

      const [, beatmapId] = beatmapSetUrl.match(/\/beatmapsets\/(\d+)/) ?? []
      if (!beatmapId) {
        reacord.ephemeralReply(
          interaction,
          `Invalid beatmap url "${beatmapSetUrl}"`,
        )
        return
      }

      await interaction.deferReply({ ephemeral: true })

      const beatmapSet = await BeatmapSet.fromBeatmapSetId(beatmapId)
      if (beatmapSet.beatmaps.length === 0) {
        reacord.ephemeralReply(
          interaction,
          `No beatmaps found for beatmap set ${beatmapId}`,
        )
        return
      }

      let selectedIndex
      const beatmapSelectReply = reacord.ephemeralReply(interaction)

      if (beatmapSet.beatmaps.length === 1) {
        selectedIndex = 0
      } else {
        selectedIndex = await new Promise<number | undefined>((resolve) => {
          beatmapSelectReply.render(
            <BeatmapSelect beatmapSet={beatmapSet} onConfirm={resolve} />,
          )
        })
        if (selectedIndex === undefined) {
          beatmapSelectReply.render("Alright, carry on.")
          beatmapSelectReply.deactivate()
          return
        }
      }

      beatmapSelectReply.render("Starting now! You can delete this.")

      const beatmap =
        beatmapSet.beatmaps[selectedIndex] ??
        raise(`Unexpected error: beatmap index ${selectedIndex} not found`)

      const audio = await beatmapSet.loadBeatmapAudio(beatmap)

      const beatmapSummary = `**${beatmap.metadata.artist} - ${beatmap.metadata.title} [${beatmap.metadata.version}]**`

      const reply = reacord.reply(
        interaction,
        `<a:time:675548186672234519> <@${interaction.user.id}> Creating beatmap preview for ${beatmapSummary} (this might take a while!)`,
      )

      let videoPath
      try {
        // eslint-disable-next-line unicorn/no-array-reduce
        const latestHitObject = beatmap.hitObjects.reduce((a, b) =>
          a.startTime > b.startTime ? a : b,
        )

        videoPath = await renderVideo({
          audio,
          durationSeconds: latestHitObject.startTime / 1000 + 2,
          renderView: createBeatmapRenderer(beatmap),
        })
      } catch (error) {
        reply.render(`Failed to create preview for ${beatmapSummary}`)
        console.error(error)
        return
      }

      const stats = await stat(videoPath).catch(() => undefined)
      if (!stats) {
        reply.render(`Failed to create preview for ${beatmapSummary}`)
        return
      }

      if (stats.size > 1024 ** 2 * 8) {
        reply.render(
          `Failed to create preview for ${beatmapSummary}: file is too large (${prettyBytes(
            stats.size,
          )})`,
        )
        return
      }

      const bpmMin = Math.round(beatmap.bpmMin)
      const bpmMax = Math.round(beatmap.bpmMax)
      const bpmMode = Math.round(beatmap.bpmMode)

      function getBPMDisplay() {
        if (bpmMode === bpmMin && bpmMode === bpmMax) {
          return `BPM: **${bpmMode}**`
        }
        return `BPM: **${bpmMin}-${bpmMax} (${bpmMode})**`
      }

      await interaction.followUp({
        embeds: [
          {
            title: beatmapSummary,
            url: beatmapSetUrl,
            description: [
              `Previewed by <@${interaction.user.id}>`,
              `Beatmap by **${beatmap.metadata.creator}**`,
              getBPMDisplay(),
              `CS **${beatmap.difficulty.circleSize.toFixed(1)}** | ` +
                `AR **${beatmap.difficulty.approachRate.toFixed(1)}** | ` +
                `OD **${beatmap.difficulty.overallDifficulty.toFixed(1)}** | ` +
                `HP **${beatmap.difficulty.drainRate.toFixed(1)}**`,
            ].join("\n"),
          },
        ],
        files: [
          {
            name: "preview.mp4",
            description: `Beatmap preview for ${beatmapSummary}`,
            attachment: await readFile(videoPath),
          },
        ],
      })

      reply.destroy()

      await rm(videoPath, { force: true })
    },
  }
}

function BeatmapSelect({
  beatmapSet,
  onConfirm,
}: {
  beatmapSet: BeatmapSet
  onConfirm: (beatmapIndex: number | undefined) => void
}) {
  const [beatmapIndex, setBeatmapIndex] = React.useState("0")
  return (
    <>
      Which beatmap should I use?
      <Select value={beatmapIndex} onChangeValue={setBeatmapIndex}>
        {beatmapSet.beatmaps.map((beatmap, index) => (
          <Option
            key={beatmap.metadata.beatmapId}
            value={String(index)}
            label={beatmap.metadata.version.slice(0, 100)}
            description={`${beatmap.metadata.artist} - ${beatmap.metadata.title}`.slice(
              0,
              100,
            )}
          />
        ))}
      </Select>
      <Button
        label="Create preview"
        style="primary"
        onClick={() => onConfirm(Number(beatmapIndex))}
      />
      <Button
        label="Cancel"
        style="secondary"
        onClick={() => onConfirm(undefined)}
      />
    </>
  )
}
