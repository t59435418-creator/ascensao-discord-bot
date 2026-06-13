import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { errorEmbed, infoEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { ratingsTable } from "@workspace/db";
import { eq, and, avg, count } from "drizzle-orm";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
  .setName("avaliar")
  .setDescription("Avalie um membro do servidor")
  .addSubcommand((s) =>
    s
      .setName("dar")
      .setDescription("Dê uma avaliação a um membro")
      .addUserOption((o) => o.setName("usuario").setDescription("Membro a avaliar").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("estrelas").setDescription("Avaliação de 1 a 5 estrelas").setMinValue(1).setMaxValue(5).setRequired(true)
      )
      .addStringOption((o) => o.setName("comentario").setDescription("Comentário opcional").setRequired(false))
  )
  .addSubcommand((s) =>
    s
      .setName("ver")
      .setDescription("Veja a avaliação de um membro")
      .addUserOption((o) => o.setName("usuario").setDescription("Membro para ver avaliações").setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "dar") {
    const target = interaction.options.getUser("usuario", true);
    const estrelas = interaction.options.getInteger("estrelas", true);
    const comentario = interaction.options.getString("comentario");

    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode se auto-avaliar.")], ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode avaliar bots.")], ephemeral: true });
    }

    const existingRating = await db
      .select()
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.targetId, `${target.id}-${interaction.guildId}`),
          eq(ratingsTable.raterId, interaction.user.id),
          eq(ratingsTable.guildId, interaction.guildId!)
        )
      )
      .limit(1);

    if (existingRating.length > 0) {
      await db
        .update(ratingsTable)
        .set({ stars: estrelas, comment: comentario ?? null, createdAt: new Date() })
        .where(eq(ratingsTable.id, existingRating[0].id));
    } else {
      await db.insert(ratingsTable).values({
        id: randomUUID(),
        targetId: `${target.id}-${interaction.guildId}`,
        guildId: interaction.guildId!,
        raterId: interaction.user.id,
        stars: estrelas,
        comment: comentario ?? null,
      });
    }

    const stars = "⭐".repeat(estrelas) + "☆".repeat(5 - estrelas);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("⭐ Avaliação Enviada!")
          .setDescription(`Você avaliou **${target.username}** com ${stars}\n${comentario ? `\n💬 *"${comentario}"*` : ""}`)
          .setThumbnail(target.displayAvatarURL())
          .setTimestamp(),
      ],
    });
  }

  if (sub === "ver") {
    const target = interaction.options.getUser("usuario", true);
    const ratings = await db
      .select()
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.targetId, `${target.id}-${interaction.guildId}`),
          eq(ratingsTable.guildId, interaction.guildId!)
        )
      );

    if (ratings.length === 0) {
      return interaction.reply({
        embeds: [infoEmbed(`⭐ Avaliações de ${target.username}`, "Este membro ainda não recebeu nenhuma avaliação.")],
      });
    }

    const totalStars = ratings.reduce((s, r) => s + r.stars, 0);
    const avgStars = (totalStars / ratings.length).toFixed(1);
    const starDisplay = "⭐".repeat(Math.round(totalStars / ratings.length));

    const recentComments = ratings
      .filter((r) => r.comment)
      .slice(-3)
      .map((r) => `> *"${r.comment}"* — <@${r.raterId}>`)
      .join("\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle(`⭐ Avaliações de ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: "Média", value: `${starDisplay} **${avgStars}/5**`, inline: true },
            { name: "Total de Avaliações", value: `${ratings.length}`, inline: true },
          )
          .setDescription(recentComments || "Sem comentários.")
          .setTimestamp(),
      ],
    });
  }
}
