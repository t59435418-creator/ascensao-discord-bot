import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { infoEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Verifica a latência do bot");

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({ embeds: [infoEmbed("🏓 Pong!", "Calculando latência...")], fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  return interaction.editReply({
    embeds: [
      infoEmbed("🏓 Pong!", `⏱️ **Latência:** ${latency}ms\n📡 **API Discord:** ${apiLatency}ms`),
    ],
  });
}
