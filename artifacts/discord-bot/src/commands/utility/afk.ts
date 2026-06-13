import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { afkTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("afk")
  .setDescription("Ativa ou desativa seu status de AFK")
  .addStringOption((o) =>
    o.setName("motivo").setDescription("Motivo do AFK").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const motivo = interaction.options.getString("motivo") ?? "AFK";
  const key = `${interaction.user.id}-${interaction.guildId}`;

  const existing = await db
    .select()
    .from(afkTable)
    .where(eq(afkTable.id, key))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(afkTable).where(eq(afkTable.id, key));
    return interaction.reply({
      embeds: [successEmbed("AFK Removido", `Bem-vindo de volta, **${interaction.user.username}**! Seu AFK foi removido.`)],
    });
  }

  await db.insert(afkTable).values({
    id: key,
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    motivo,
  }).onConflictDoUpdate({ target: afkTable.id, set: { motivo, setAt: new Date() } });

  return interaction.reply({
    embeds: [successEmbed("AFK Ativado", `✅ **${interaction.user.username}** está AFK.\n📋 Motivo: **${motivo}**\n\nSerei notificado quando alguém te mencionar.`)],
  });
}
