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
import { eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
  .setName("evento")
  .setDescription("Sistema de eventos do servidor")
  .addSubcommand((s) =>
    s
      .setName("criar")
      .setDescription("Cria um novo evento")
      .addStringOption((o) => o.setName("titulo").setDescription("Título do evento").setRequired(true))
      .addStringOption((o) => o.setName("descricao").setDescription("Descrição do evento").setRequired(true))
      .addStringOption((o) =>
        o.setName("data-hora").setDescription("Data e hora do evento (formato: DD/MM/YYYY HH:MM)").setRequired(true)
      )
      .addChannelOption((o) =>
        o.setName("canal").setDescription("Canal para anunciar o evento").setRequired(false).addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((o) => o.setName("premio").setDescription("Prêmio para participantes (opcional)").setRequired(false))
  )
  .addSubcommand((s) =>
    s
      .setName("encerrar")
      .setDescription("Encerra um evento")
      .addStringOption((o) => o.setName("id").setDescription("ID do evento").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("listar")
      .setDescription("Lista eventos ativos do servidor")
  )
  .addSubcommand((s) =>
    s
      .setName("participantes")
      .setDescription("Veja quem está participando de um evento")
      .addStringOption((o) => o.setName("id").setDescription("ID do evento").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const titulo = interaction.options.getString("titulo", true);
    const descricao = interaction.options.getString("descricao", true);
    const dataHoraStr = interaction.options.getString("data-hora", true);
    const canal = (interaction.options.getChannel("canal") ?? interaction.channel) as TextChannel;
    const premio = interaction.options.getString("premio");

    const [datePart, timePart] = dataHoraStr.split(" ");
    const [day, month, year] = datePart.split("/").map(Number);
    const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
    const eventAt = new Date(year, month - 1, day, hour, minute);

    if (isNaN(eventAt.getTime()) || eventAt < new Date()) {
      return interaction.reply({ embeds: [errorEmbed("Data Inválida", "Use o formato DD/MM/YYYY HH:MM e escolha uma data futura.")], ephemeral: true });
    }

    const id = randomUUID().slice(0, 8).toUpperCase();
    const embed = buildEventEmbed(titulo, descricao, eventAt, interaction.user.id, 0, id, premio);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`event_join_${id}`).setLabel("✅ Participar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`event_leave_${id}`).setLabel("❌ Sair").setStyle(ButtonStyle.Danger),
    );

    await interaction.deferReply({ ephemeral: true });
    const msg = await canal.send({ embeds: [embed], components: [row] });

    await db.insert(eventsTable).values({
      id,
      guildId: interaction.guildId!,
      channelId: canal.id,
      messageId: msg.id,
      title: titulo,
      description: descricao,
      eventAt,
      createdBy: interaction.user.id,
      participants: "",
      prize: premio,
    });

    const msUntilEvent = eventAt.getTime() - Date.now();
    if (msUntilEvent > 0 && msUntilEvent < 24 * 60 * 60 * 1000) {
      setTimeout(async () => {
        const event = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
        if (!event[0] || event[0].ended) return;
        const parts = event[0].participants ? event[0].participants.split(",").filter(Boolean) : [];
        if (parts.length > 0) {
          await canal.send({ content: parts.map((p) => `<@${p}>`).join(" "), embeds: [infoEmbed("🔔 Evento Começando!", `O evento **${titulo}** está começando agora!`).setColor(0xf1c40f)] });
        }
      }, msUntilEvent);
    }

    return interaction.editReply({ embeds: [successEmbed("Evento Criado!", `🎯 Evento **${titulo}** criado em <#${canal.id}>!\n🆔 ID: \`${id}\``)] });
  }

  if (sub === "encerrar") {
    const id = interaction.options.getString("id", true).toUpperCase();
    const event = await db.select().from(eventsTable).where(and(eq(eventsTable.id, id), eq(eventsTable.guildId, interaction.guildId!))).limit(1);
    if (!event[0]) return interaction.reply({ embeds: [errorEmbed("Erro", "Evento não encontrado.")], ephemeral: true });

    await db.update(eventsTable).set({ ended: true }).where(eq(eventsTable.id, id));

    const channel = interaction.guild?.channels.cache.get(event[0].channelId) as TextChannel;
    if (channel && event[0].messageId) {
      const msg = await channel.messages.fetch(event[0].messageId).catch(() => null);
      const parts = event[0].participants ? event[0].participants.split(",").filter(Boolean) : [];
      if (msg) {
        const endEmbed = buildEventEmbed(event[0].title, event[0].description, event[0].eventAt, event[0].createdBy, parts.length, id, event[0].prize)
          .setTitle(`✅ EVENTO ENCERRADO — ${event[0].title}`)
          .setColor(0xe74c3c);
        await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
      }
      await channel.send({ embeds: [infoEmbed(`🏁 Evento Encerrado`, `O evento **${event[0].title}** foi encerrado!\n👥 **${parts.length}** participante(s).`)] });
    }

    return interaction.reply({ embeds: [successEmbed("Evento Encerrado", `O evento \`${id}\` foi encerrado!`)], ephemeral: true });
  }

  if (sub === "listar") {
    const events = await db.select().from(eventsTable).where(and(eq(eventsTable.guildId, interaction.guildId!), eq(eventsTable.ended, false)));
    if (events.length === 0) return interaction.reply({ embeds: [infoEmbed("Eventos", "Nenhum evento ativo no momento.")], ephemeral: true });

    const list = events.map((e) => `\`${e.id}\` **${e.title}** — <t:${Math.floor(e.eventAt.getTime() / 1000)}:R>`).join("\n");
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("📅 Eventos Ativos").setDescription(list).setTimestamp()],
      ephemeral: true,
    });
  }

  if (sub === "participantes") {
    const id = interaction.options.getString("id", true).toUpperCase();
    const event = await db.select().from(eventsTable).where(and(eq(eventsTable.id, id), eq(eventsTable.guildId, interaction.guildId!))).limit(1);
    if (!event[0]) return interaction.reply({ embeds: [errorEmbed("Erro", "Evento não encontrado.")], ephemeral: true });

    const parts = event[0].participants ? event[0].participants.split(",").filter(Boolean) : [];
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`👥 Participantes — ${event[0].title}`)
          .setDescription(parts.length > 0 ? parts.map((p) => `<@${p}>`).join("\n") : "Nenhum participante ainda.")
          .setFooter({ text: `Total: ${parts.length} participante(s)` })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

export async function handleEventButton(interaction: ButtonInteraction) {
  const isJoin = interaction.customId.startsWith("event_join_");
  const id = interaction.customId.replace("event_join_", "").replace("event_leave_", "");
  const event = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);

  if (!event[0] || event[0].ended) {
    return interaction.reply({ content: "❌ Este evento já encerrou!", ephemeral: true });
  }

  let participants = event[0].participants ? event[0].participants.split(",").filter(Boolean) : [];

  if (isJoin) {
    if (participants.includes(interaction.user.id)) {
      return interaction.reply({ content: "✅ Você já está inscrito neste evento!", ephemeral: true });
    }
    participants.push(interaction.user.id);
    await db.update(eventsTable).set({ participants: participants.join(",") }).where(eq(eventsTable.id, id));
    await interaction.reply({ content: `✅ Você foi inscrito no evento **${event[0].title}**!`, ephemeral: true });
  } else {
    if (!participants.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Você não está inscrito neste evento.", ephemeral: true });
    }
    participants = participants.filter((p) => p !== interaction.user.id);
    await db.update(eventsTable).set({ participants: participants.join(",") }).where(eq(eventsTable.id, id));
    await interaction.reply({ content: `❌ Você saiu do evento **${event[0].title}**.`, ephemeral: true });
  }

  const updated = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  const embed = buildEventEmbed(updated[0].title, updated[0].description, updated[0].eventAt, updated[0].createdBy, participants.length, id, updated[0].prize);
  await interaction.message.edit({ embeds: [embed] }).catch(() => {});
}

function buildEventEmbed(title: string, description: string, eventAt: Date, createdBy: string, participants: number, id: string, prize?: string | null) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📅 ${title}`)
    .setDescription(description)
    .addFields(
      { name: "📆 Data e Hora", value: `<t:${Math.floor(eventAt.getTime() / 1000)}:F>`, inline: true },
      { name: "👥 Inscritos", value: `${participants}`, inline: true },
      { name: "🎯 Organizado por", value: `<@${createdBy}>`, inline: true },
    )
    .setFooter({ text: `ID: ${id} • Clique em ✅ Participar para se inscrever!` })
    .setTimestamp();

  if (prize) embed.addFields({ name: "🏆 Prêmio", value: prize, inline: true });
  return embed;
}

function infoEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(0x3498db).setTitle(title).setDescription(desc).setTimestamp();
}
