import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Silencia um membro (timeout)")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário a ser silenciado").setRequired(true))
  .addIntegerOption((o) =>
    o.setName("minutos").setDescription("Duração em minutos (máx 40320 = 28 dias)").setMinValue(1).setMaxValue(40320).setRequired(true)
  )
  .addStringOption((o) => o.setName("motivo").setDescription("Motivo do mute").setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para silenciar membros.")], ephemeral: true });
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  const user = interaction.options.getUser("usuario", true);
  const minutos = interaction.options.getInteger("minutos", true);
  const motivo = interaction.options.getString("motivo") ?? "Nenhum motivo fornecido";

  if (!target) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Usuário não encontrado.")], ephemeral: true });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode silenciar a si mesmo.")], ephemeral: true });
  }

  if (!target.moderatable) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não consigo silenciar este usuário.")], ephemeral: true });
  }

  const duration = minutos * 60 * 1000;

  try {
    await target.timeout(duration, `${motivo} | Moderador: ${interaction.user.tag}`);

    const humanTime = minutos >= 60
      ? `${Math.floor(minutos / 60)}h ${minutos % 60}m`
      : `${minutos}m`;

    return interaction.reply({
      embeds: [
        successEmbed("Membro Silenciado", `**${user.tag}** foi silenciado por **${humanTime}**.\n📋 **Motivo:** ${motivo}`)
          .setThumbnail(user.displayAvatarURL()),
      ],
    });
  } catch {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não foi possível silenciar o usuário.")], ephemeral: true });
  }
}
