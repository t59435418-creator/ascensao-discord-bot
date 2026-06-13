import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Expulsa um membro do servidor")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário a ser expulso").setRequired(true))
  .addStringOption((o) => o.setName("motivo").setDescription("Motivo da expulsão").setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para expulsar membros.")], ephemeral: true });
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  const user = interaction.options.getUser("usuario", true);
  const motivo = interaction.options.getString("motivo") ?? "Nenhum motivo fornecido";

  if (!target) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Usuário não encontrado no servidor.")], ephemeral: true });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode expulsar a si mesmo.")], ephemeral: true });
  }

  if (!target.kickable) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não consigo expulsar este usuário. Verifique se meu cargo é superior ao dele.")], ephemeral: true });
  }

  try {
    await target.send(
      `👢 Você foi **expulso** do servidor **${interaction.guild?.name}**.\n📋 Motivo: ${motivo}\n👮 Moderador: ${interaction.user.tag}`
    ).catch(() => {});

    await target.kick(`${motivo} | Moderador: ${interaction.user.tag}`);

    return interaction.reply({
      embeds: [
        successEmbed("Membro Expulso", `**${user.tag}** foi expulso com sucesso.\n📋 **Motivo:** ${motivo}`)
          .setThumbnail(user.displayAvatarURL()),
      ],
    });
  } catch {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não foi possível expulsar o usuário.")], ephemeral: true });
  }
}
