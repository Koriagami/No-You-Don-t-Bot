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
const { token, clientId } = require("./config.json");

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

  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
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

  function ensureAllowlist() {
    if (!allowLists.has(guildId)) {
      allowLists.set(guildId, { users: new Set(), roles: new Set() });
    }
    return allowLists.get(guildId);
  }

  // Existing per-channel & global logic unchanged...

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

// Monitor messages
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const guildId = message.guildId;

  // Check allowlist
  if (allowLists.has(guildId)) {
    const allow = allowLists.get(guildId);
    if (allow.users.has(message.author.id) || message.member.roles.cache.some((r) => allow.roles.has(r.id))) {
      return; // Skip blocked link check
    }
  }

  const content = message.content.toLowerCase();

  // Channel-specific rules
  if (blockRules.has(message.channel.id)) {
    const partials = blockRules.get(message.channel.id);
    if (content.includes("http")) {
      for (const partial of partials) {
        if (content.includes(partial)) {
          try {
            await message.delete();
          } catch (err) {
            console.error("Failed delete:", err);
          }
          return;
        }
      }
    }
  }

  // Global rules
  if (globalBlockRules.has(guildId)) {
    const partials = globalBlockRules.get(guildId);
    if (content.includes("http")) {
      for (const partial of partials) {
        if (content.includes(partial)) {
          try {
            await message.delete();
          } catch (err) {
            console.error("Failed delete:", err);
          }
          return;
        }
      }
    }
  }
});

client.login(token);
