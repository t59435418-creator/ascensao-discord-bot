import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, TextChannel, ChannelType,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { pollsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const OPTION_EMOJIS = ["🇦", "🇧", "🇨", "🇩", "🇪"];
const COLORS = [0x5865f2, 0xed4245, 0x57f287, 0xfee75c, 0xeb459e];

export const data = new SlashCommandBuilder()
  .setName("enquete")
  .setDescription("Crie enquetes interativas com botões")
  .addSubcommand((s) =>
    s
      .setName("criar")
      .setDescription("Cria uma nova enquete")
      .addStringOption((o) => o.setName("pergunta").setDescription("A pergunta da enquete").setRequired(true))
      .addStringOption((o) => o.setName("opcao1").setDescription("Opção 1").setRequired(true))
      .addStringOption((o) => o.setName("opcao2").setDescription("Opção 2").setRequired(true))
      .addStringOption((o) => o.setName("opcao3").setDescription("Opção 3").setRequired(false))
      .addStringOption((o) => o.setName("opcao4").setDescription("Opção 4").setRequired(false))
      .addStringOption((o) => o.setName("opcao5").setDescription("Opção 5").setRequired(false))
      .addIntegerOption((o) => o.setName("minutos").setDescription("Duração em minutos (0 = sem limite)").setMinValue(0).setRequired(false))
      .addChannelOption((o) => o.setName("canal").setDescription("Canal da enquete").setRequired(false).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand((s) =>
    s.setName("encerrar").setDescription("Encerra uma enquete")
      .addStringOption((o) => o.setName("id").setDescription("ID da enquete").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const pergunta = interaction.options.getString("pergunta", true);
    const minutos = interaction.options.getInteger("minutos") ?? 0;
    const canal = (interaction.options.getChannel("canal") ?? interaction.channel) as TextChannel;
    const opcoes = [
      interaction.options.getString("opcao1", true),
      interaction.options.getString("opcao2", true),
      interaction.options.getString("opcao3"),
      interaction.options.getString("opcao4"),
      interaction.options.getString("opcao5"),
    ].filter(Boolean) as string[];

    const id = randomUUID().slice(0, 8).toUpperCase();
    const endAt = minutos > 0 ? new Date(Date.now() + minutos * 60_000) : null;
    const votes: Record<string, number> = {};
    opcoes.forEach((_, i) => (votes[i] = 0));

    const embed = buildPollEmbed(pergunta, opcoes, votes, interaction.user.id, endAt, id, false);
    const rows = buildPollButtons(id, opcoes, false);

    await interaction.deferReply({ ephemeral: true });
    const msg = await canal.send({ embeds: [embed], components: rows });

    await db.insert(pollsTable).values({
      id,
      guildId: interaction.guildId!,
      channelId: canal.id,
      messageId: msg.id,
      question: pergunta,
      options: JSON.stringify(opcoes),
      votes: JSON.stringify(votes),
      voterIds: "",
      createdBy: interaction.user.id,
      endAt,
    });

    if (endAt && minutos > 0) {
      setTimeout(() => closePoll(id, interaction.client as any), minutos * 60_000);
    }

    return interaction.editReply({ embeds: [successEmbed("Enquete Criada!", `🗳️ Enquete em <#${canal.id}>!\n🆔 ID: \`${id}\``)] });
  }

  if (sub === "encerrar") {
    const id = interaction.options.getString("id", true).toUpperCase();
    await closePoll(id, interaction.client as any);
    return interaction.reply({ embeds: [successEmbed("Enquete Encerrada", `A enquete \`${id}\` foi encerrada.`)], ephemeral: true });
  }
}

export async function handlePollButton(interaction: ButtonInteraction) {
  const parts = interaction.customId.split("_");
  const pollId = parts[2];
  const optionIdx = parseInt(parts[3]);

  const poll = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId)).limit(1);
  if (!poll[0] || poll[0].ended) return interaction.reply({ content: "❌ Esta enquete já foi encerrada!", ephemeral: true });

  const voterIds = poll[0].voterIds ? poll[0].voterIds.split(",").filter(Boolean) : [];
  if (voterIds.includes(interaction.user.id)) return interaction.reply({ content: "✅ Você já votou nesta enquete!", ephemeral: true });

  const opcoes = JSON.parse(poll[0].options) as string[];
  const votes = JSON.parse(poll[0].votes) as Record<string, number>;
  votes[optionIdx] = (votes[optionIdx] ?? 0) + 1;
  voterIds.push(interaction.user.id);

  await db.update(pollsTable).set({ votes: JSON.stringify(votes), voterIds: voterIds.join(",") }).where(eq(pollsTable.id, pollId));

  const endAt = poll[0].endAt ? new Date(poll[0].endAt) : null;
  const embed = buildPollEmbed(poll[0].question, opcoes, votes, poll[0].createdBy, endAt, pollId, false);
  await interaction.update({ embeds: [embed] });
}

async function closePoll(id: string, client: any) {
  const poll = await db.select().from(pollsTable).where(eq(pollsTable.id, id)).limit(1);
  if (!poll[0] || poll[0].ended) return;
  await db.update(pollsTable).set({ ended: true }).where(eq(pollsTable.id, id));

  const opcoes = JSON.parse(poll[0].options) as string[];
  const votes = JSON.parse(poll[0].votes) as Record<string, number>;
  const channel = client.channels?.cache?.get(poll[0].channelId) as TextChannel | undefined;
  if (!channel || !poll[0].messageId) return;
  const msg = await channel.messages.fetch(poll[0].messageId).catch(() => null);
  if (!msg) return;
  const embed = buildPollEmbed(poll[0].question, opcoes, votes, poll[0].createdBy, poll[0].endAt ? new Date(poll[0].endAt) : null, id, true);
  await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
}

function buildPollEmbed(question: string, options: string[], votes: Record<string, number>, createdBy: string, endAt: Date | null, id: string, ended: boolean) {
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...Object.values(votes), 1);

  const fields = options.map((opt, i) => {
    const count = votes[i] ?? 0;
    const pct = totalVotes > 0 ? Math.floor((count / totalVotes) * 100) : 0;
    const bar = "█".repeat(Math.floor((count / maxVotes) * 10)) + "░".repeat(10 - Math.floor((count / maxVotes) * 10));
    return { name: `${OPTION_EMOJIS[i]} ${opt}`, value: `\`${bar}\` **${count}** voto(s) (${pct}%)`, inline: false };
  });

  return new EmbedBuilder()
    .setColor(ended ? 0x808080 : 0x5865f2)
    .setTitle(ended ? `🔒 [ENCERRADA] ${question}` : `🗳️ ${question}`)
    .addFields(...fields, { name: "📊 Total de votos", value: `**${totalVotes}**`, inline: true }, { name: "👤 Criado por", value: `<@${createdBy}>`, inline: true }, ...(endAt ? [{ name: "⏰ Encerra", value: `<t:${Math.floor(endAt.getTime() / 1000)}:R>`, inline: true }] : []))
    .setFooter({ text: `ID: ${id} • Cada membro pode votar uma vez` })
    .setTimestamp();
}

function buildPollButtons(id: string, options: string[], disabled: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`poll_vote_${id}_${i}`)
      .setLabel(opt.slice(0, 80))
      .setEmoji(OPTION_EMOJIS[i])
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}
