import type {
  ApplicationCommandOptionData,
  CommandInteraction,
} from "discord.js"
import { Client, Intents } from "discord.js"
import "dotenv/config"
import { readFile, rm, stat } from "node:fs/promises"
import prettyBytes from "pretty-bytes"
import { Button, Option, ReacordDiscordJs, Select } from "reacord"
import * as React from "react"
import { createBeatmapRenderer } from "./beatmap-renderer"
import { BeatmapSet } from "./beatmap-set"
import { raise } from "./helpers/errors"
import { renderVideo } from "./render-video"

const client = new Client<true>({
  intents: [Intents.FLAGS.GUILDS],
})

const reacord = new ReacordDiscordJs(client)

// https://osu.ppy.sh/beatmapsets/740990
type BotCommand = {
  name: string
  description: string
  options?: ApplicationCommandOptionData[]
  run: (interaction: CommandInteraction) => unknown
}

const commands: BotCommand[] = [
  {
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

      function BeatmapSelect({
        onConfirm,
      }: {
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

      const beatmapSelectReply = reacord.ephemeralReply(interaction)

      const selectedIndex = await new Promise<number | undefined>((resolve) => {
        beatmapSelectReply.render(<BeatmapSelect onConfirm={resolve} />)
      })
      beatmapSelectReply.render("Starting now! You can delete this.")

      if (selectedIndex === undefined) {
        return
      }

      const reply = reacord.reply(interaction)

      const beatmap =
        beatmapSet.beatmaps[selectedIndex] ??
        raise(`Unexpected error: beatmap index ${selectedIndex} not found`)

      const audio = await beatmapSet.loadBeatmapAudio(beatmap)

      const beatmapSummary = `**${beatmap.metadata.artist} - ${beatmap.metadata.title} [${beatmap.metadata.version}]**`

      reply.render(
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
  },
]

client.on("ready", async () => {
  try {
    await Promise.all(
      commands.map(async ({ name, description, options }) => {
        await client.application.commands.create({
          name,
          description,
          options,
        })
      }),
    )
  } catch (error) {
    console.error("Error on ready:", error)
  }
  console.info("Ready!")
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return

  const command = commands.find((c) => c.name === interaction.commandName)

  try {
    await command?.run(interaction)
  } catch (error) {
    console.error(`Failed to run command ${interaction.commandName}:`, error)
    reacord.ephemeralReply(interaction, "Oops, something went wrong.")
  }
})

await client.login(process.env.DISCORD_BOT_TOKEN)

function joinContentfulValues(values: unknown[], separator: string) {
  return values.filter(Boolean).join(separator)
}
