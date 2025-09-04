const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Get information about the server or a user")
    .addUserOption((option) => option.setName("user").setDescription("The user to get info about").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("User Information")
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Username", value: user.username, inline: true },
        { name: "Display Name", value: member.displayName, inline: true },
        { name: "User ID", value: user.id, inline: true },
        { name: "Joined Server", value: member.joinedAt.toDateString(), inline: true },
        { name: "Account Created", value: user.createdAt.toDateString(), inline: true },
        { name: "Roles", value: member.roles.cache.map((role) => role.name).join(", ") || "None", inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};
