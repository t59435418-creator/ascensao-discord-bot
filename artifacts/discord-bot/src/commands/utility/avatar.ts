import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Veja o avatar de um usuário em tamanho grande")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário para ver o avatar").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("usuario") ?? interaction.user;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`🖼️ Avatar de ${user.tag}`)
    .setImage(user.displayAvatarURL({ size: 1024 }))
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
