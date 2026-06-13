import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Veja informações do servidor");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  await guild.fetch();

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🏠 ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
    .addFields(
      { name: "🆔 ID do Servidor", value: guild.id, inline: true },
      { name: "👑 Dono", value: `<@${guild.ownerId}>`, inline: true },
      { name: "📅 Criado em", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      { name: "👥 Membros", value: `${guild.memberCount}`, inline: true },
      { name: "💬 Canais", value: `${guild.channels.cache.size}`, inline: true },
      { name: "🎭 Cargos", value: `${guild.roles.cache.size}`, inline: true },
      { name: "😀 Emojis", value: `${guild.emojis.cache.size}`, inline: true },
      { name: "🔒 Verificação", value: `${guild.verificationLevel}`, inline: true },
      { name: "🚀 Boosts", value: `${guild.premiumSubscriptionCount ?? 0} (Nível ${guild.premiumTier})`, inline: true },
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
