"use strict";

require("dotenv").config();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const { Client, GatewayIntentBits, Partials, ChannelType, Events } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  // Partials required to receive DM events for channels not cached yet
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

// Workaround: discord.js sometimes drops MESSAGE_CREATE events for DMs when the
// DM channel isn't cached yet. Listen at the raw packet level and warm the
// channel cache before the normal messageCreate dispatch runs.
client.on("raw", async (packet) => {
  if (!packet || packet.t !== "MESSAGE_CREATE") return;
  if (packet.d?.guild_id) return; // only DMs have no guild_id
  const channelId = packet.d?.channel_id;
  if (!channelId) return;
  if (client.channels.cache.has(channelId)) return;
  try {
    const ch = await client.channels.fetch(channelId);
    console.log(`[raw] pre-fetched DM channel ${channelId} (type=${ch?.type})`);
    // Re-emit the message so our handler sees it (since discord.js dropped it).
    if (ch && packet.d) {
      const msg = await ch.messages.fetch(packet.d.id).catch(() => null);
      if (msg) client.emit(Events.MessageCreate, msg);
    }
  } catch (err) {
    console.error(`[raw] failed to fetch DM channel ${channelId}:`, err);
  }
});

client.once("ready", () => {
  console.log(`[ready] Logged in as ${client.user.tag} (id: ${client.user.id})`);
  console.log(`[ready] Invite URL: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=274877908992`);
  console.log(`[ready] In ${client.guilds.cache.size} guild(s):`);
  for (const [, guild] of client.guilds.cache) {
    console.log(`  - ${guild.name} (id: ${guild.id})`);
  }
});

client.on("debug", (info) => {
  if (/heartbeat|Heartbeat/i.test(info)) return;
  console.log(`[debug] ${info}`);
});

client.on("warn", (info) => console.warn(`[warn] ${info}`));
client.on("error", (err) => console.error(`[error]`, err));

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const isDM = message.channel.type === ChannelType.DM;
  const isMentioned = message.mentions.users.has(client.user.id);

  console.log(
    `[message] from=${message.author.tag} channelType=${message.channel.type} isDM=${isDM} isMentioned=${isMentioned} content=${JSON.stringify(message.content)}`
  );

  if (!isDM && !isMentioned) return;

  const cleaned = message.content.replace(/<@!?\d+>/g, "").trim();
  const reply = cleaned
    ? `pong: you said "${cleaned}"`
    : "pong (empty message)";

  try {
    await message.reply(reply);
    console.log(`[reply] sent: ${reply}`);
  } catch (err) {
    console.error("[reply] failed:", err);
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN in environment. Add it to .env");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
