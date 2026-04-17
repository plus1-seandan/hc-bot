"use strict";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const isDM = message.channel.type === ChannelType.DM;
  const isMentioned = message.mentions.has(client.user);

  if (!isDM && !isMentioned) return;

  const content = message.content.replace(/<@!?\d+>/g, "").trim();
  if (!content) return;

  try {
    await message.channel.sendTyping();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const reply = response.content[0].text;
    // Discord has a 2000 char limit per message
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      for (let i = 0; i < reply.length; i += 2000) {
        await message.channel.send(reply.slice(i, i + 2000));
      }
    }
  } catch (err) {
    console.error("Error:", err);
    await message.reply("Sorry, something went wrong.");
  }
});

client.login(process.env.DISCORD_TOKEN);
