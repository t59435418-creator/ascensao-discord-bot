import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  TextChannel,
  ChannelType,
} from "discord.js";
import { successEmbed, errorEmbed, infoEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { giveawaysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
  .setName("sorteio")
  .setDescription("Sistema de sorteios")
  .addSubcommand((s) =>
    s
      .setName("criar")
      .setDescription("Cria um novo sorteio")
      .addStringOption((o) => o.setName("premio").setDescription("O prêmio do sorteio").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("minutos").setDescription("Duração em minutos").setMinValue(1).setRequired(true)
      )
      .addChannelOption((o) =>
        o.setName("canal").setDescription("Canal onde o sorteio será realizado").setRequired(false).addChannelTypes(ChannelType.GuildText)
      )
      .addIntegerOption((o) =>
        o.setName("vencedores").setDescription("Quantidade de vencedores (padrão: 1)").setMinValue(1).setMaxValue(10).setRequired(false)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("encerrar")
      .setDescription("Encerra um sorteio imediatamente")
      .addStringOption((o) => o.setName("id").setDescription("ID do sorteio").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("resorteiar")
      .setDescription("Sorteia novos vencedores de um sorteio encerrado")
      .addStringOption((o) => o.setName("id").setDescription("ID do sorteio").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const premio = interaction.options.getString("premio", true);
    const minutos = interaction.options.getInteger("minutos", true);
    const vencedores = interaction.options.getInteger("vencedores") ?? 1;
    const canal = (interaction.options.getChannel("canal") ?? interaction.channel) as TextChannel;

    const endAt = new Date(Date.now() + minutos * 60 * 1000);
    const id = randomUUID().slice(0, 8).toUpperCase();

    const embed = buildGiveawayEmbed(premio, endAt, interaction.user.id, vencedores, 0, id);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`giveaway_enter_${id}`).setLabel("🎉 Participar").setStyle(ButtonStyle.Success),
    );

    await interaction.deferReply({ ephemeral: true });

    const msg = await canal.send({ embeds: [embed], components: [row] });
    await db.insert(giveawaysTable).values({
      id,
      guildId: interaction.guildId!,
      channelId: canal.id,
      messageId: msg.id,
      prize: premio,
      winnersCount: vencedores,
      hostedBy: interaction.user.id,
      endAt,
      participants: "",
      winners: "",
    });

    setTimeout(() => endGiveaway(id, interaction.client as any), minutos * 60 * 1000);

    return interaction.editReply({
      embeds: [successEmbed("Sorteio Criado!", `🎉 Sorteio **${premio}** criado em <#${canal.id}>!\n🆔 ID: \`${id}\`\n⏰ Encerra em **${minutos} minuto(s)**`)],
    });
  }

  if (sub === "encerrar") {
    const id = interaction.options.getString("id", true).toUpperCase();
    const giveaway = await db.select().from(giveawaysTable).where(and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, interaction.guildId!))).limit(1);
    if (!giveaway[0]) return interaction.reply({ embeds: [errorEmbed("Erro", "Sorteio não encontrado.")], ephemeral: true });
    if (giveaway[0].ended) return interaction.reply({ embeds: [errorEmbed("Erro", "Este sorteio já foi encerrado.")], ephemeral: true });

    await endGiveaway(id, interaction.client as any);
    return interaction.reply({ embeds: [successEmbed("Sorteio Encerrado", `O sorteio \`${id}\` foi encerrado!`)], ephemeral: true });
  }

  if (sub === "resorteiar") {
    const id = interaction.options.getString("id", true).toUpperCase();
    const giveaway = await db.select().from(giveawaysTable).where(and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, interaction.guildId!))).limit(1);
    if (!giveaway[0]) return interaction.reply({ embeds: [errorEmbed("Erro", "Sorteio não encontrado.")], ephemeral: true });

    const participants = giveaway[0].participants ? giveaway[0].participants.split(",").filter(Boolean) : [];
    if (participants.length === 0) return interaction.reply({ embeds: [errorEmbed("Erro", "Nenhum participante no sorteio.")], ephemeral: true });

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, giveaway[0].winnersCount);
    const mentionWinners = winners.map((w) => `<@${w}>`).join(", ");

    const channel = interaction.guild?.channels.cache.get(giveaway[0].channelId) as TextChannel;
    await channel?.send({ embeds: [infoEmbed("🎉 Re-sorteio!", `Novo(s) vencedor(es) do sorteio **${giveaway[0].prize}**:\n\n🏆 ${mentionWinners}\n\nParabéns!`).setColor(0xf1c40f)] });
    return interaction.reply({ embeds: [successEmbed("Re-sorteio!", `Novos vencedores sorteados!`)], ephemeral: true });
  }
}

export async function handleGiveawayButton(interaction: ButtonInteraction) {
  const id = interaction.customId.replace("giveaway_enter_", "");
  const giveaway = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, id)).limit(1);

  if (!giveaway[0] || giveaway[0].ended) {
    return interaction.reply({ content: "❌ Este sorteio já encerrou!", ephemeral: true });
  }

  const participants = giveaway[0].participants ? giveaway[0].participants.split(",").filter(Boolean) : [];
  if (participants.includes(interaction.user.id)) {
    return interaction.reply({ content: "✅ Você já está participando deste sorteio!", ephemeral: true });
  }

  participants.push(interaction.user.id);
  await db.update(giveawaysTable).set({ participants: participants.join(",") }).where(eq(giveawaysTable.id, id));

  const updated = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, id)).limit(1);
  const embed = buildGiveawayEmbed(giveaway[0].prize, giveaway[0].endAt, giveaway[0].hostedBy, giveaway[0].winnersCount, participants.length, id);
  await interaction.update({ embeds: [embed] });
}

function buildGiveawayEmbed(prize: string, endAt: Date, hostedBy: string, winners: number, participants: number, id: string) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🎉 SORTEIO!")
    .addFields(
      { name: "🏆 Prêmio", value: prize, inline: true },
      { name: "👑 Vencedores", value: `${winners}`, inline: true },
      { name: "👥 Participantes", value: `${participants}`, inline: true },
      { name: "⏰ Encerra em", value: `<t:${Math.floor(endAt.getTime() / 1000)}:R>`, inline: true },
      { name: "🎫 Organizado por", value: `<@${hostedBy}>`, inline: true },
    )
    .setFooter({ text: `ID: ${id} • Clique em 🎉 Participar para entrar!` })
    .setTimestamp();
}

export async function endGiveaway(id: string, client: any) {
  const giveaway = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, id)).limit(1);
  if (!giveaway[0] || giveaway[0].ended) return;

  const participants = giveaway[0].participants ? giveaway[0].participants.split(",").filter(Boolean) : [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, giveaway[0].winnersCount);

  await db.update(giveawaysTable).set({ ended: true, winners: winners.join(",") }).where(eq(giveawaysTable.id, id));

  const channel = client.channels?.cache?.get(giveaway[0].channelId) as TextChannel | undefined;
  if (!channel) return;

  const endEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🎉 SORTEIO ENCERRADO!")
    .addFields(
      { name: "🏆 Prêmio", value: giveaway[0].prize, inline: true },
      { name: "👥 Participantes", value: `${participants.length}`, inline: true },
    )
    .setDescription(
      winners.length > 0
        ? `🏆 **Vencedor(es):** ${winners.map((w) => `<@${w}>`).join(", ")}\n\nParabéns aos vencedores! 🎊`
        : "😔 Nenhum participante no sorteio."
    )
    .setFooter({ text: `ID: ${id}` })
    .setTimestamp();

  if (giveaway[0].messageId) {
    const msg = await channel.messages.fetch(giveaway[0].messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
  }

  if (winners.length > 0) {
    await channel.send({ content: winners.map((w) => `<@${w}>`).join(", "), embeds: [infoEmbed("🎊 Parabéns!", `Você ganhou o sorteio de **${giveaway[0].prize}**!`).setColor(0xf1c40f)] });
  }
}

function infoEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(0x3498db).setTitle(title).setDescription(desc).setTimestamp();
}
