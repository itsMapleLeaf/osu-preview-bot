import { Client, Intents } from "discord.js"
import "dotenv/config"
import { ReacordDiscordJs } from "reacord"
import {
  createCommandInteractionHandler,
  registerCommands,
} from "./bot-command"
import { createPreviewCommand } from "./preview-command"

const client = new Client<true>({
  intents: [Intents.FLAGS.GUILDS],
})

const reacord = new ReacordDiscordJs(client)
const commands = [createPreviewCommand(reacord)]

client.on("ready", async () => {
  try {
    await registerCommands(client, commands)
  } catch (error) {
    console.error("Error on ready:", error)
  }
})

client.on(
  "interactionCreate",
  createCommandInteractionHandler(reacord, commands),
)

await client.login(process.env.DISCORD_BOT_TOKEN)
console.info("Ready!")
