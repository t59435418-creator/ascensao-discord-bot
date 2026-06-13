import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { successEmbed, errorEmbed, infoEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { ticketConfigTable, ticketsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Sistema de tickets")
  .addSubcommand((s) =>
    s.setName("painel").setDescription("Envia o painel de configuração de tickets (Admin)")
  )
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configura o sistema de tickets (Admin)")
      .addChannelOption((o) => o.setName("canal-tickets").setDescription("Canal onde os tickets serão abertos").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addChannelOption((o) => o.setName("canal-transcript").setDescription("Canal para salvar transcripts").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addRoleOption((o) => o.setName("cargo-suporte").setDescription("Cargo mencionado ao abrir ticket").setRequired(false))
      .addRoleOption((o) => o.setName("cargo-ver").setDescription("Cargo que pode ver tickets").setRequired(false))
      .addRoleOption((o) => o.setName("cargo-gerenciar").setDescription("Cargo que pode fechar/excluir tickets").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("fechar").setDescription("Fecha o ticket atual")
  )
  .addSubcommand((s) =>
    s.setName("config-ver").setDescription("Veja as configurações de ticket atuais (Admin)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem configurar tickets.")], ephemeral: true });
    }

    const canalTickets = interaction.options.getChannel("canal-tickets");
    const canalTranscript = interaction.options.getChannel("canal-transcript");
    const cargoSuporte = interaction.options.getRole("cargo-suporte");
    const cargoVer = interaction.options.getRole("cargo-ver");
    const cargoGerenciar = interaction.options.getRole("cargo-gerenciar");

    const existing = await db.select().from(ticketConfigTable).where(eq(ticketConfigTable.guildId, interaction.guildId!)).limit(1);

    const update: Partial<typeof ticketConfigTable.$inferInsert> = {
      guildId: interaction.guildId!,
      updatedAt: new Date(),
    };
    if (canalTickets) update.channelId = canalTickets.id;
    if (canalTranscript) update.transcriptChannelId = canalTranscript.id;
    if (cargoSuporte) update.mentionRoleId = cargoSuporte.id;
    if (cargoVer) update.viewRoleId = cargoVer.id;
    if (cargoGerenciar) update.manageRoleId = cargoGerenciar.id;

    if (existing.length > 0) {
      await db.update(ticketConfigTable).set(update).where(eq(ticketConfigTable.guildId, interaction.guildId!));
    } else {
      await db.insert(ticketConfigTable).values({ ...update } as any);
    }

    return interaction.reply({
      embeds: [successEmbed("Tickets Configurado!", "As configurações de ticket foram salvas com sucesso!\n\nUse `/ticket painel` para enviar o painel de abertura de tickets.")],
      ephemeral: true,
    });
  }

  if (sub === "config-ver") {
    const config = await db.select().from(ticketConfigTable).where(eq(ticketConfigTable.guildId, interaction.guildId!)).limit(1);

    if (!config[0]) {
      return interaction.reply({ embeds: [errorEmbed("Não Configurado", "O sistema de tickets ainda não foi configurado. Use `/ticket configurar`.")], ephemeral: true });
    }

    const c = config[0];
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("🎫 Configuração de Tickets")
          .addFields(
            { name: "📬 Canal de Tickets", value: c.channelId ? `<#${c.channelId}>` : "Não definido", inline: true },
            { name: "📄 Canal de Transcript", value: c.transcriptChannelId ? `<#${c.transcriptChannelId}>` : "Não definido", inline: true },
            { name: "🔔 Cargo Mencionado", value: c.mentionRoleId ? `<@&${c.mentionRoleId}>` : "Não definido", inline: true },
            { name: "👁️ Cargo que Vê", value: c.viewRoleId ? `<@&${c.viewRoleId}>` : "Não definido", inline: true },
            { name: "🛡️ Cargo que Gerencia", value: c.manageRoleId ? `<@&${c.manageRoleId}>` : "Não definido", inline: true },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  if (sub === "painel") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem enviar o painel de tickets.")], ephemeral: true });
    }

    const config = await db.select().from(ticketConfigTable).where(eq(ticketConfigTable.guildId, interaction.guildId!)).limit(1);
    if (!config[0]?.channelId) {
      return interaction.reply({ embeds: [errorEmbed("Não Configurado", "Configure o canal de tickets primeiro com `/ticket configurar canal-tickets:#canal`.")], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎫 Sistema de Tickets")
      .setDescription("Precisa de ajuda ou suporte? Clique no botão abaixo para abrir um ticket!\n\nNossa equipe responderá o mais rápido possível.")
      .addFields(
        { name: "📋 Como funciona?", value: "1. Clique em **Abrir Ticket**\n2. Um canal privado será criado para você\n3. Descreva seu problema\n4. Aguarde a equipe de suporte" },
      )
      .setFooter({ text: `${interaction.guild?.name} • Sistema de Suporte` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary),
    );

    const targetChannel = interaction.guild?.channels.cache.get(config[0].channelId) as TextChannel;
    if (!targetChannel) {
      return interaction.reply({ embeds: [errorEmbed("Erro", "Canal de tickets não encontrado.")], ephemeral: true });
    }

    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ embeds: [successEmbed("Painel Enviado!", `Painel de tickets enviado em ${targetChannel}!`)], ephemeral: true });
  }

  if (sub === "fechar") {
    const ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, interaction.channelId)).limit(1);
    if (!ticket[0] || ticket[0].status !== "open") {
      return interaction.reply({ embeds: [errorEmbed("Erro", "Este canal não é um ticket aberto.")], ephemeral: true });
    }

    await db.update(ticketsTable).set({ status: "closed", closedBy: interaction.user.id, closedAt: new Date() }).where(eq(ticketsTable.id, ticket[0].id));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_delete").setLabel("🗑️ Excluir Ticket").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_reopen").setLabel("🔓 Reabrir Ticket").setStyle(ButtonStyle.Success),
    );

    await interaction.reply({
      embeds: [infoEmbed("🔒 Ticket Fechado", `Este ticket foi fechado por **${interaction.user.username}**.\nUse os botões abaixo para excluir ou reabrir.`)],
      components: [row],
    });
  }
}

export async function handleTicketButton(interaction: ButtonInteraction) {
  const config = await db.select().from(ticketConfigTable).where(eq(ticketConfigTable.guildId, interaction.guildId!)).limit(1);

  if (interaction.customId === "ticket_open") {
    const existing = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.userId, interaction.user.id))
      .limit(1);

    const openTicket = existing.find((t) => t.status === "open" && t.guildId === interaction.guildId);
    if (openTicket) {
      return interaction.reply({
        embeds: [errorEmbed("Ticket Já Aberto", `Você já tem um ticket aberto: <#${openTicket.channelId}>`)],
        ephemeral: true,
      });
    }

    const ticketChannel = await interaction.guild!.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild!.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
        ...(config[0]?.viewRoleId ? [{ id: config[0].viewRoleId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] as any }] : []),
        ...(config[0]?.manageRoleId ? [{ id: config[0].manageRoleId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageMessages"] as any }] : []),
      ],
    });

    const ticketId = randomUUID();
    await db.insert(ticketsTable).values({
      id: ticketId,
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      channelId: ticketChannel.id,
      status: "open",
    });

    const mention = config[0]?.mentionRoleId ? `<@&${config[0].mentionRoleId}>` : "";

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🎫 Ticket Aberto")
      .setDescription(`Olá, **${interaction.user.username}**! Seu ticket foi criado.\nDescreva seu problema e aguarde a equipe de suporte.${mention ? `\n\n${mention}` : ""}`)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_close_btn").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ content: mention || undefined, embeds: [embed], components: [row] });

    return interaction.reply({
      embeds: [successEmbed("Ticket Criado!", `Seu ticket foi aberto em ${ticketChannel}!`)],
      ephemeral: true,
    });
  }

  if (interaction.customId === "ticket_close_btn") {
    const ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, interaction.channelId)).limit(1);
    if (!ticket[0] || ticket[0].status !== "open") return;

    await db.update(ticketsTable).set({ status: "closed", closedBy: interaction.user.id, closedAt: new Date() }).where(eq(ticketsTable.id, ticket[0].id));

    const config = await db.select().from(ticketConfigTable).where(eq(ticketConfigTable.guildId, interaction.guildId!)).limit(1);
    if (config[0]?.transcriptChannelId) {
      const channel = interaction.channel as TextChannel;
      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = [...messages.values()]
        .reverse()
        .map((m) => `[${m.createdAt.toLocaleString("pt-BR")}] ${m.author.tag}: ${m.content || "[embed/attachment]"}`)
        .join("\n");

      const transcriptChannel = interaction.guild?.channels.cache.get(config[0].transcriptChannelId) as TextChannel;
      if (transcriptChannel) {
        const { AttachmentBuilder } = await import("discord.js");
        const buffer = Buffer.from(transcript, "utf-8");
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel?.name}.txt` });
        await transcriptChannel.send({
          embeds: [infoEmbed(`📄 Transcript — ${interaction.channel?.name}`, `Ticket de <@${ticket[0].userId}>\nFechado por: <@${interaction.user.id}>`)],
          files: [attachment],
        });
      }
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_delete").setLabel("🗑️ Excluir").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_reopen").setLabel("🔓 Reabrir").setStyle(ButtonStyle.Success),
    );

    return interaction.reply({
      embeds: [infoEmbed("🔒 Ticket Fechado", `Fechado por **${interaction.user.username}**.`)],
      components: [row],
    });
  }

  if (interaction.customId === "ticket_delete") {
    await interaction.reply({ embeds: [infoEmbed("🗑️ Excluindo...", "Este canal será excluído em 5 segundos.")], ephemeral: false });
    setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
  }

  if (interaction.customId === "ticket_reopen") {
    const ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, interaction.channelId)).limit(1);
    if (!ticket[0]) return;

    await db.update(ticketsTable).set({ status: "open", closedBy: null, closedAt: null }).where(eq(ticketsTable.id, ticket[0].id));
    return interaction.reply({ embeds: [successEmbed("Ticket Reaberto", "O ticket foi reaberto!")] });
  }
}
