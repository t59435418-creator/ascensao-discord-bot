import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Client,
} from "discord.js";
import { successEmbed, errorEmbed, brandEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { remindersTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
  .setName("lembrar")
  .setDescription("Sistema de lembretes via DM")
  .addSubcommand((s) =>
    s
      .setName("criar")
      .setDescription("Cria um lembrete")
      .addStringOption((o) => o.setName("mensagem").setDescription("O que você quer ser lembrado?").setRequired(true))
      .addIntegerOption((o) => o.setName("valor").setDescription("Quantidade de tempo").setRequired(true).setMinValue(1))
      .addStringOption((o) =>
        o.setName("unidade").setDescription("Unidade de tempo").setRequired(true).addChoices(
          { name: "⏱️ Minutos", value: "min" },
          { name: "⏰ Horas", value: "h" },
          { name: "📅 Dias", value: "d" },
        )
      )
  )
  .addSubcommand((s) => s.setName("listar").setDescription("Lista seus lembretes ativos"))
  .addSubcommand((s) =>
    s.setName("cancelar").setDescription("Cancela um lembrete").addStringOption((o) => o.setName("id").setDescription("ID do lembrete").setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const msg = interaction.options.getString("mensagem", true);
    const valor = interaction.options.getInteger("valor", true);
    const unidade = interaction.options.getString("unidade", true);
    const multipliers: Record<string, number> = { min: 60_000, h: 3_600_000, d: 86_400_000 };
    const ms = valor * multipliers[unidade];
    const remindAt = new Date(Date.now() + ms);
    const unitLabel: Record<string, string> = { min: "minuto(s)", h: "hora(s)", d: "dia(s)" };
    const id = randomUUID().slice(0, 6).toUpperCase();

    await db.insert(remindersTable).values({
      id,
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      reminder: msg,
      remindAt,
    });

    setTimeout(() => deliverReminder(id, interaction.client as any), ms);

    return interaction.reply({
      embeds: [successEmbed("Lembrete Criado!", `⏰ Te lembrarei em **${valor} ${unitLabel[unidade]}**!\n\n📝 **"${msg}"**\n\n🆔 ID: \`${id}\`\n📬 Você receberá via DM.`)],
      ephemeral: true,
    });
  }

  if (sub === "listar") {
    const reminders = await db.select().from(remindersTable)
      .where(and(eq(remindersTable.userId, interaction.user.id), eq(remindersTable.reminded, false)));
    if (reminders.length === 0) return interaction.reply({ embeds: [brandEmbed("⏰ Seus Lembretes", "Nenhum lembrete ativo.")], ephemeral: true });
    const list = reminders.map((r) => `\`${r.id}\` — **${r.reminder.slice(0, 50)}**\n↳ <t:${Math.floor(r.remindAt.getTime() / 1000)}:R>`).join("\n\n");
    return interaction.reply({ embeds: [brandEmbed("⏰ Seus Lembretes", list)], ephemeral: true });
  }

  if (sub === "cancelar") {
    const id = interaction.options.getString("id", true).toUpperCase();
    const deleted = await db.delete(remindersTable)
      .where(and(eq(remindersTable.id, id), eq(remindersTable.userId, interaction.user.id)));
    return interaction.reply({ embeds: [successEmbed("Lembrete Cancelado", `Lembrete \`${id}\` removido.`)], ephemeral: true });
  }
}

export async function deliverReminder(id: string, client: Client) {
  const reminder = await db.select().from(remindersTable).where(eq(remindersTable.id, id)).limit(1);
  if (!reminder[0] || reminder[0].reminded) return;
  await db.update(remindersTable).set({ reminded: true }).where(eq(remindersTable.id, id));
  const user = await client.users.fetch(reminder[0].userId).catch(() => null);
  if (!user) return;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("⏰ Lembrete!")
    .setDescription(`📝 **${reminder[0].reminder}**`)
    .setFooter({ text: `ID: ${id}` })
    .setTimestamp();
  await user.send({ embeds: [embed] }).catch(() => {});
}

export async function checkPendingReminders(client: Client) {
  const pending = await db.select().from(remindersTable)
    .where(and(eq(remindersTable.reminded, false), lt(remindersTable.remindAt, new Date())));
  for (const r of pending) {
    await deliverReminder(r.id, client);
  }
}
