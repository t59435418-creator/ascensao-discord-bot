import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Bane um membro do servidor")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário a ser banido").setRequired(true))
  .addStringOption((o) => o.setName("motivo").setDescription("Motivo do ban").setRequired(false))
  .addIntegerOption((o) =>
    o.setName("dias").setDescription("Deletar mensagens dos últimos X dias (0-7)").setMinValue(0).setMaxValue(7)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para banir membros.")], ephemeral: true });
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  const user = interaction.options.getUser("usuario", true);
  const motivo = interaction.options.getString("motivo") ?? "Nenhum motivo fornecido";
  const dias = interaction.options.getInteger("dias") ?? 0;

  if (!target) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Usuário não encontrado no servidor.")], ephemeral: true });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode banir a si mesmo.")], ephemeral: true });
  }

  if (!target.bannable) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não consigo banir este usuário. Verifique se meu cargo é superior ao dele.")], ephemeral: true });
  }

  try {
    await target.send(
      `🔨 Você foi **banido** do servidor **${interaction.guild?.name}**.\n📋 Motivo: ${motivo}\n👮 Moderador: ${interaction.user.tag}`
    ).catch(() => {});

    await target.ban({ deleteMessageDays: dias, reason: `${motivo} | Moderador: ${interaction.user.tag}` });

    return interaction.reply({
      embeds: [
        successEmbed("Membro Banido", `**${user.tag}** foi banido com sucesso.\n📋 **Motivo:** ${motivo}\n🗑️ **Mensagens deletadas:** últimos ${dias} dia(s)`)
          .setThumbnail(user.displayAvatarURL()),
      ],
    });
  } catch (err) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não foi possível banir o usuário.")], ephemeral: true });
  }
}
