import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { reputationTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isSameDay } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("rep")
  .setDescription("Sistema de reputação entre membros")
  .addSubcommand((s) =>
    s
      .setName("dar")
      .setDescription("Dê +1 de reputação a um membro (1x por dia)")
      .addUserOption((o) => o.setName("membro").setDescription("Quem você quer elogiar?").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("ver")
      .setDescription("Veja a reputação de alguém")
      .addUserOption((o) => o.setName("membro").setDescription("Membro").setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "dar") {
    const target = interaction.options.getUser("membro", true);
    if (target.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode dar reputação para si mesmo!")], ephemeral: true });
    if (target.bot) return interaction.reply({ embeds: [errorEmbed("Erro", "Não é possível dar rep para bots.")], ephemeral: true });

    const giverKey = `${interaction.user.id}-${interaction.guildId}`;
    const giverRep = await db.select().from(reputationTable).where(eq(reputationTable.id, giverKey)).limit(1);
    if (giverRep[0]?.lastGivenAt && isSameDay(new Date(giverRep[0].lastGivenAt), new Date())) {
      return interaction.reply({ embeds: [errorEmbed("Cooldown", `Você já deu reputação hoje!\nVolta amanhã para dar novamente.`)], ephemeral: true });
    }

    const targetKey = `${target.id}-${interaction.guildId}`;
    const targetRep = await db.select().from(reputationTable).where(eq(reputationTable.id, targetKey)).limit(1);
    const currentRep = targetRep[0]?.reputation ?? 0;

    await db.insert(reputationTable).values({ id: targetKey, guildId: interaction.guildId!, reputation: 1, lastGivenAt: null, lastGivenTo: null })
      .onConflictDoUpdate({ target: reputationTable.id, set: { reputation: currentRep + 1 } });

    await db.insert(reputationTable).values({ id: giverKey, guildId: interaction.guildId!, reputation: 0, lastGivenAt: new Date(), lastGivenTo: target.id })
      .onConflictDoUpdate({ target: reputationTable.id, set: { lastGivenAt: new Date(), lastGivenTo: target.id } });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("⭐ Reputação Dada!")
          .setDescription(`${interaction.user} deu **+1 reputação** para ${target}!\n\n⭐ ${target.username} agora tem **${currentRep + 1}** ponto(s) de reputação!`)
          .setThumbnail(target.displayAvatarURL({ size: 64 }))
          .setFooter({ text: "Você pode dar reputação novamente amanhã." })
          .setTimestamp(),
      ],
    });
  }

  if (sub === "ver") {
    const target = interaction.options.getUser("membro") ?? interaction.user;
    const key = `${target.id}-${interaction.guildId}`;
    const repRecord = await db.select().from(reputationTable).where(eq(reputationTable.id, key)).limit(1);
    const rep = repRecord[0]?.reputation ?? 0;
    const stars = rep >= 100 ? "🌟" : rep >= 50 ? "⭐" : rep >= 25 ? "✨" : "🔘";

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle(`${stars} Reputação de ${target.username}`)
          .setThumbnail(target.displayAvatarURL({ size: 64 }))
          .addFields(
            { name: "⭐ Reputação", value: `**+${rep}** pontos`, inline: true },
            { name: "🏆 Rank", value: rep >= 100 ? "🌟 Lendário" : rep >= 50 ? "⭐ Famoso" : rep >= 25 ? "✨ Respeitado" : rep >= 10 ? "🔹 Conhecido" : "🔘 Iniciante", inline: true },
          )
          .setTimestamp(),
      ],
    });
  }
}
