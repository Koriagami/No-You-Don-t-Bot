const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("Get information about the current server"),
  async execute(interaction) {
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Server Information")
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: "Server Name", value: guild.name, inline: true },
        { name: "Server ID", value: guild.id, inline: true },
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Created", value: guild.createdAt.toDateString(), inline: true },
        { name: "Members", value: guild.memberCount.toString(), inline: true },
        { name: "Channels", value: guild.channels.cache.size.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};
