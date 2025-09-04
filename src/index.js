/*
 NYD Bot: Delete messages containing links with prohibited partials.

 Features:
 - Slash commands:
   /nyd block <channel> <filtered_partial>
   /nyd list <channel>
   /nyd unblock <channel> <filtered_partial>
   /nyd block-global <filtered_partial>
   /nyd list-global
   /nyd unblock-global <filtered_partial>
   /nyd allow-user <user>
   /nyd remove-allow <user>
   /nyd allow-role <role>
   /nyd remove-allow-role <role>
   /nyd list-allow
 - Tracks rules in memory (per channel, globally, and allowlist)
 - Deletes any user message in specified channel or globally if it contains link(s) with prohibited partials, unless user or role is allowlisted

 Requirements:
 - discord.js v14
 - Global slash commands
 - In-memory storage (no persistence across restarts)
*/

const { Client, GatewayIntentBits, Partials, SlashCommandBuilder, Routes, PermissionFlagsBits } = require("discord.js");
const { REST } = require("@discordjs/rest");
require("dotenv").config();

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is required in .env file");
  process.exit(1);
}
if (!process.env.CLIENT_ID) {
  console.error("❌ CLIENT_ID is required in .env file");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// In-memory store: channelId -> Set of partial strings
const blockRules = new Map();
// Global block list: guildId -> Set of partial strings
const globalBlockRules = new Map();
// Allowlist: guildId -> { users: Set<userId>, roles: Set<roleId> }
const allowLists = new Map();

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("nyd")
      .setDescription("NYD Bot controls")
      .addSubcommand((sub) =>
        sub
          .setName("block")
          .setDescription("Block links containing a partial in a specific channel")
          .addChannelOption((opt) => opt.setName("channel").setDescription("Channel to monitor").setRequired(true))
          .addStringOption((opt) =>
            opt.setName("filtered_partial").setDescription('Part of link to block (e.g. "tiktok")').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List blocked partials in a channel")
          .addChannelOption((opt) => opt.setName("channel").setDescription("Channel to check").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("unblock")
          .setDescription("Remove a blocked partial from a channel")
          .addChannelOption((opt) => opt.setName("channel").setDescription("Channel to modify").setRequired(true))
          .addStringOption((opt) => opt.setName("filtered_partial").setDescription("Partial to remove").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("block-global")
          .setDescription("Block links containing a partial across the whole server")
          .addStringOption((opt) =>
            opt.setName("filtered_partial").setDescription('Part of link to block (e.g. "tiktok")').setRequired(true)
          )
      )
      .addSubcommand((sub) => sub.setName("list-global").setDescription("List globally blocked partials for this server"))
      .addSubcommand((sub) =>
        sub
          .setName("unblock-global")
          .setDescription("Remove a globally blocked partial from this server")
          .addStringOption((opt) => opt.setName("filtered_partial").setDescription("Partial to remove").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("allow-user")
          .setDescription("Allow a user to bypass link blocking")
          .addUserOption((opt) => opt.setName("user").setDescription("User to allow").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove-allow")
          .setDescription("Remove a user from allowlist")
          .addUserOption((opt) => opt.setName("user").setDescription("User to remove from allowlist").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("allow-role")
          .setDescription("Allow a role to bypass link blocking")
          .addRoleOption((opt) => opt.setName("role").setDescription("Role to allow").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove-allow-role")
          .setDescription("Remove a role from allowlist")
          .addRoleOption((opt) => opt.setName("role").setDescription("Role to remove from allowlist").setRequired(true))
      )
      .addSubcommand((sub) => sub.setName("list-allow").setDescription("List all allowlisted users and roles in this server"))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .setDMPermission(false),
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log("NYD commands registered");
}

client.once("ready", async () => {
  console.log(`NYD Bot logged in as ${client.user.tag}`);
  await registerCommands();
});

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "nyd") return;

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  // Check if command is used in a guild
  if (!guildId) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  function ensureAllowlist() {
    if (!allowLists.has(guildId)) {
      allowLists.set(guildId, { users: new Set(), roles: new Set() });
    }
    return allowLists.get(guildId);
  }

  // Channel-specific commands
  if (sub === "block") {
    const channel = interaction.options.getChannel("channel");
    const partial = interaction.options.getString("filtered_partial").toLowerCase();

    if (!blockRules.has(channel.id)) {
      blockRules.set(channel.id, new Set());
    }
    blockRules.get(channel.id).add(partial);
    await interaction.reply({ content: `✅ Blocked links containing "${partial}" in ${channel}.`, ephemeral: true });
  }

  if (sub === "list") {
    const channel = interaction.options.getChannel("channel");
    const partials = blockRules.get(channel.id);
    const list = partials ? Array.from(partials).join(", ") : "None";
    await interaction.reply({ content: `📋 Blocked partials in ${channel}: ${list}`, ephemeral: true });
  }

  if (sub === "unblock") {
    const channel = interaction.options.getChannel("channel");
    const partial = interaction.options.getString("filtered_partial").toLowerCase();

    if (!blockRules.has(channel.id) || !blockRules.get(channel.id).has(partial)) {
      await interaction.reply({ content: `⚠️ "${partial}" was not blocked in ${channel}.`, ephemeral: true });
      return;
    }
    blockRules.get(channel.id).delete(partial);
    await interaction.reply({ content: `✅ Removed "${partial}" from ${channel} block list.`, ephemeral: true });
  }

  // Global commands
  if (sub === "block-global") {
    const partial = interaction.options.getString("filtered_partial").toLowerCase();

    if (!globalBlockRules.has(guildId)) {
      globalBlockRules.set(guildId, new Set());
    }
    globalBlockRules.get(guildId).add(partial);
    await interaction.reply({ content: `✅ Blocked links containing "${partial}" server-wide.`, ephemeral: true });
  }

  if (sub === "list-global") {
    const partials = globalBlockRules.get(guildId);
    const list = partials ? Array.from(partials).join(", ") : "None";
    await interaction.reply({ content: `📋 Globally blocked partials: ${list}`, ephemeral: true });
  }

  if (sub === "unblock-global") {
    const partial = interaction.options.getString("filtered_partial").toLowerCase();

    if (!globalBlockRules.has(guildId) || !globalBlockRules.get(guildId).has(partial)) {
      await interaction.reply({ content: `⚠️ "${partial}" was not globally blocked.`, ephemeral: true });
      return;
    }
    globalBlockRules.get(guildId).delete(partial);
    await interaction.reply({ content: `✅ Removed "${partial}" from global block list.`, ephemeral: true });
  }

  // Allowlist - user
  if (sub === "allow-user") {
    const user = interaction.options.getUser("user");
    const allow = ensureAllowlist();
    allow.users.add(user.id);
    await interaction.reply({ content: `✅ ${user.tag} is now allowlisted.`, ephemeral: true });
  }

  if (sub === "remove-allow") {
    const user = interaction.options.getUser("user");
    const allow = ensureAllowlist();
    if (!allow.users.has(user.id)) {
      await interaction.reply({ content: `⚠️ ${user.tag} was not on the allowlist.`, ephemeral: true });
      return;
    }
    allow.users.delete(user.id);
    await interaction.reply({ content: `✅ ${user.tag} removed from allowlist.`, ephemeral: true });
  }

  // Allowlist - role
  if (sub === "allow-role") {
    const role = interaction.options.getRole("role");
    const allow = ensureAllowlist();
    allow.roles.add(role.id);
    await interaction.reply({ content: `✅ Role ${role.name} is now allowlisted.`, ephemeral: true });
  }

  if (sub === "remove-allow-role") {
    const role = interaction.options.getRole("role");
    const allow = ensureAllowlist();
    if (!allow.roles.has(role.id)) {
      await interaction.reply({ content: `⚠️ Role ${role.name} was not on the allowlist.`, ephemeral: true });
      return;
    }
    allow.roles.delete(role.id);
    await interaction.reply({ content: `✅ Role ${role.name} removed from allowlist.`, ephemeral: true });
  }

  // List allowlist
  if (sub === "list-allow") {
    const allow = ensureAllowlist();
    const userMentions =
      Array.from(allow.users)
        .map((id) => `<@${id}>`)
        .join(", ") || "None";
    const roleMentions =
      Array.from(allow.roles)
        .map((id) => `<@&${id}>`)
        .join(", ") || "None";
    await interaction.reply({ content: `✅ Allowlisted users: ${userMentions}\n✅ Allowlisted roles: ${roleMentions}`, ephemeral: true });
  }
});

// Helper function to check if message should be deleted
async function checkAndDeleteMessage(message, partials) {
  if (!partials || partials.size === 0) return false;

  const content = message.content.toLowerCase();
  if (!content.includes("http")) return false;

  // Check if bot has permission to delete messages
  if (!message.guild.members.me.permissions.has("ManageMessages")) {
    console.error("Bot lacks 'Manage Messages' permission to delete messages");
    return false;
  }

  for (const partial of partials) {
    if (content.includes(partial)) {
      try {
        await message.delete();
        console.log(`Deleted message containing "${partial}" from ${message.author.tag}`);
        return true;
      } catch (err) {
        console.error(`Failed to delete message containing "${partial}":`, err);
        return false; // Return false if deletion failed
      }
    }
  }
  return false;
}

// Monitor messages
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Check if we have access to message content
  if (!message.content) {
    console.log("Message content not available - MessageContent intent may not be enabled");
    return;
  }

  const guildId = message.guildId;
  if (!guildId) return; // Skip DMs

  // Check allowlist
  if (allowLists.has(guildId)) {
    const allow = allowLists.get(guildId);
    if (allow.users.has(message.author.id) || message.member.roles.cache.some((r) => allow.roles.has(r.id))) {
      return; // Skip blocked link check
    }
  }

  // Check channel-specific rules first
  if (blockRules.has(message.channel.id)) {
    const deleted = await checkAndDeleteMessage(message, blockRules.get(message.channel.id));
    if (deleted) return;
  }

  // Check global rules
  if (globalBlockRules.has(guildId)) {
    await checkAndDeleteMessage(message, globalBlockRules.get(guildId));
  }
});

client.login(process.env.DISCORD_TOKEN);
