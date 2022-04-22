import type {
  ApplicationCommandOptionData,
  Client,
  CommandInteraction,
  Interaction,
} from "discord.js"
import type { ReacordDiscordJs } from "reacord"

export type Command = {
  name: string
  description: string
  options?: ApplicationCommandOptionData[]
  run: (interaction: CommandInteraction) => unknown
}

export function handleCommands({
  client,
  reacord,
  commands,
}: {
  client: Client
  reacord: ReacordDiscordJs
  commands: Command[]
}) {
  client.on("ready", async () => {
    try {
      await client.application?.commands.set(
        commands.map(({ name, description, options }) => ({
          name,
          description,
          options,
        })),
      )
    } catch (error) {
      console.error("Failed to register commands:", error)
    }
  })

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isCommand()) return
    try {
      const command = commands.find((c) => c.name === interaction.commandName)
      await command?.run(interaction)
    } catch (error) {
      console.error(`Failed to run command ${interaction.commandName}:`, error)
      reacord.ephemeralReply(interaction, "Oops, something went wrong.")
    }
  })
}
