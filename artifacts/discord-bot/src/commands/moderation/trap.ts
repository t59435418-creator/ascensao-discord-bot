import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { successEmbed, errorEmbed, infoEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { trapChannelsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("canal-armadilha")
  .setDescription("Sistema de canal armadilha — pune membros que enviam mensagens no canal")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configura um canal armadilha (Admin)")
      .addChannelOption((o) =>
        o.setName("canal").setDescription("Canal que será a armadilha").setRequired(true).addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((o) =>
        o
          .setName("acao-mensagem")
          .setDescription("O que fazer quando o membro enviar uma mensagem de texto")
          .setRequired(true)
          .addChoices(
            { name: "🦶 Kick (expulsar)", value: "kick" },
            { name: "🔨 Ban (banir)", value: "ban" }
          )
      )
      .addStringOption((o) =>
        o
          .setName("acao-imagem")
          .setDescription("O que fazer quando o membro enviar uma imagem/anexo")
          .setRequired(true)
          .addChoices(
            { name: "🦶 Kick (expulsar)", value: "kick" },
            { name: "🔨 Ban (banir)", value: "ban" }
          )
      )
  )
  .addSubcommand((s) =>
    s
      .setName("remover")
      .setDescription("Remove a armadilha de um canal")
      .addChannelOption((o) =>
        o.setName("canal").setDescription("Canal para remover a armadilha").setRequired(true).addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((s) => s.setName("listar").setDescription("Lista todos os canais armadilha do servidor"))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem gerenciar canais armadilha.")], ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    const canal = interaction.options.getChannel("canal", true);
    const acaoMsg = interaction.options.getString("acao-mensagem", true);
    const acaoImg = interaction.options.getString("acao-imagem", true);

    const id = `${interaction.guildId}-${canal.id}`;
    const record = {
      id,
      guildId: interaction.guildId!,
      channelId: canal.id,
      actionMessage: acaoMsg,
      actionImage: acaoImg,
      createdBy: interaction.user.id,
    };

    await db.insert(trapChannelsTable).values(record)
      .onConflictDoUpdate({ target: trapChannelsTable.id, set: { actionMessage: acaoMsg, actionImage: acaoImg } });

    const acaoMsgLabel = acaoMsg === "ban" ? "🔨 Banido" : "🦶 Expulso";
    const acaoImgLabel = acaoImg === "ban" ? "🔨 Banido" : "🦶 Expulso";

    return interaction.reply({
      embeds: [
        successEmbed("⚠️ Canal Armadilha Configurado!", `O canal <#${canal.id}> agora é uma **armadilha**!\n\n💬 **Se enviar mensagem:** ${acaoMsgLabel}\n🖼️ **Se enviar imagem/anexo:** ${acaoImgLabel}\n\n⚠️ O membro receberá uma notificação no privado antes de ser punido.\n\n> ⚠️ **Atenção:** Esta funcionalidade requer **Message Content Intent** ativado no portal Discord.`)
          .setColor(0xe74c3c),
      ],
    });
  }

  if (sub === "remover") {
    const canal = interaction.options.getChannel("canal", true);
    const id = `${interaction.guildId}-${canal.id}`;
    await db.delete(trapChannelsTable).where(eq(trapChannelsTable.id, id));
    return interaction.reply({ embeds: [successEmbed("Armadilha Removida", `O canal <#${canal.id}> não é mais uma armadilha.`)] });
  }

  if (sub === "listar") {
    const traps = await db.select().from(trapChannelsTable).where(eq(trapChannelsTable.guildId, interaction.guildId!));
    if (traps.length === 0) {
      return interaction.reply({ embeds: [infoEmbed("Canal Armadilha", "Nenhum canal armadilha configurado neste servidor.")], ephemeral: true });
    }
    const list = traps.map((t) => `<#${t.channelId}> — Msg: **${t.actionMessage}** | Img: **${t.actionImage}**`).join("\n");
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("⚠️ Canais Armadilha")
          .setDescription(list)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}
