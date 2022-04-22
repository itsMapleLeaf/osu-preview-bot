import { Client, Intents } from "discord.js"
import "dotenv/config"
import { ReacordDiscordJs } from "reacord"
import { handleCommands } from "./commands"
import { createPreviewCommand } from "./preview-command"

const client = new Client({
  intents: [Intents.FLAGS.GUILDS],
})

const reacord = new ReacordDiscordJs(client)

handleCommands({
  client,
  reacord,
  commands: [createPreviewCommand(reacord)],
})

export async function startBot() {
  await client.login(process.env.DISCORD_BOT_TOKEN)
  console.info("Ready!")
}
