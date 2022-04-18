import type {
  ApplicationCommandOptionData,
  Client,
  CommandInteraction,
  Interaction,
} from "discord.js"
import type { ReacordDiscordJs } from "reacord"

export type BotCommand = {
  name: string
  description: string
  options?: ApplicationCommandOptionData[]
  run: (interaction: CommandInteraction) => unknown
}

export async function registerCommands(client: Client, commands: BotCommand[]) {
  if (!client.isReady()) {
    throw new Error("Client is not ready")
  }
  await Promise.all(
    commands.map(async ({ name, description, options }) => {
      await client.application.commands.create({
        name,
        description,
        options,
      })
    }),
  )
}

export function createCommandInteractionHandler(
  reacord: ReacordDiscordJs,
  commands: BotCommand[],
) {
  return async function handleInteraction(interaction: Interaction) {
    if (!interaction.isCommand()) return

    const command = commands.find((c) => c.name === interaction.commandName)

    try {
      await command?.run(interaction)
    } catch (error) {
      console.error(`Failed to run command ${interaction.commandName}:`, error)
      reacord.ephemeralReply(interaction, "Oops, something went wrong.")
    }
  }
}
