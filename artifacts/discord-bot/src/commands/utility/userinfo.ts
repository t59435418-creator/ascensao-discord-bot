import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Veja informações de um usuário")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário para verificar").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("usuario") ?? interaction.user;
  const member = interaction.guild?.members.cache.get(user.id) as GuildMember | undefined;

  const roles = member?.roles.cache
    .filter((r) => r.id !== interaction.guildId)
    .sort((a, b) => b.position - a.position)
    .map((r) => r.toString())
    .slice(0, 10)
    .join(", ") || "Nenhum";

  const embed = new EmbedBuilder()
    .setColor(member?.displayHexColor || 0x3498db)
    .setTitle(`👤 Informações — ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "🆔 ID", value: user.id, inline: true },
      { name: "📅 Conta criada em", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
      { name: "📥 Entrou no servidor em", value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : "Desconhecido", inline: true },
      { name: "🤖 É bot?", value: user.bot ? "Sim" : "Não", inline: true },
      { name: "💬 Apelido", value: member?.nickname ?? "Nenhum", inline: true },
      { name: "🔇 Silenciado?", value: member?.isCommunicationDisabled() ? "Sim" : "Não", inline: true },
      { name: `🎭 Cargos (${member?.roles.cache.size ? member.roles.cache.size - 1 : 0})`, value: roles },
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
