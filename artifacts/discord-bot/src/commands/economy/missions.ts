import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance, getMissionLabel } from "../../lib/helpers.js";
import { getOrCreateUser, getOrCreateMissions, completeMission, addBalance } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("missoes")
  .setDescription("Veja suas missões diárias e complete-as para ganhar Dólares")
  .addSubcommand((sub) =>
    sub.setName("ver").setDescription("Veja suas missões de hoje")
  )
  .addSubcommand((sub) =>
    sub
      .setName("completar")
      .setDescription("Complete uma missão do dia")
      .addIntegerOption((o) =>
        o.setName("numero").setDescription("Número da missão (1, 2 ou 3)").setMinValue(1).setMaxValue(3).setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();
  const user = await getOrCreateUser(interaction.user.id, interaction.guildId!, interaction.user.username);
  const missions = await getOrCreateMissions(interaction.user.id, interaction.guildId!, interaction.user.username);

  if (sub === "ver") {
    const status = (completed: boolean, label: string, reward: number) =>
      `${completed ? "✅" : "⬜"} ${label}\n└ Recompensa: **${formatBalance(reward)}** ${completed ? "*(concluída)*" : ""}`;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("📋 Missões Diárias")
      .setDescription(`Aqui estão suas missões para hoje, **${interaction.user.username}**!\nComplete-as com \`/missoes completar numero:<1/2/3>\``)
      .addFields(
        { name: "Missão 1", value: status(missions.mission1Completed, getMissionLabel(missions.mission1Type), missions.mission1Reward) },
        { name: "Missão 2", value: status(missions.mission2Completed, getMissionLabel(missions.mission2Type), missions.mission2Reward) },
        { name: "Missão 3", value: status(missions.mission3Completed, getMissionLabel(missions.mission3Type), missions.mission3Reward) },
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: "Missões renovam todo dia à meia-noite!" })
      .setTimestamp();

    const totalPossivel = missions.mission1Reward + missions.mission2Reward + missions.mission3Reward;
    const ganho =
      (missions.mission1Completed ? missions.mission1Reward : 0) +
      (missions.mission2Completed ? missions.mission2Reward : 0) +
      (missions.mission3Completed ? missions.mission3Reward : 0);

    embed.addFields({ name: "💰 Progresso", value: `Ganho: ${formatBalance(ganho)} / Possível: ${formatBalance(totalPossivel)}` });

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === "completar") {
    const numero = interaction.options.getInteger("numero", true) as 1 | 2 | 3;
    const reward = await completeMission(interaction.user.id, interaction.guildId!, numero);

    if (reward === null) {
      const mission = missions[`mission${numero}Completed` as keyof typeof missions];
      if (mission) {
        return interaction.editReply({
          embeds: [errorEmbed("Missão já concluída", `Você já completou a missão ${numero} hoje!`)],
        });
      }
      return interaction.editReply({
        embeds: [errorEmbed("Erro", "Missão não encontrada. Use `/missoes ver` primeiro.")],
      });
    }

    const newBalance = await addBalance(interaction.user.id, interaction.guildId!, reward, "mission", `Missão ${numero} completa`);

    return interaction.editReply({
      embeds: [
        economyEmbed("Missão Concluída! 🎉", `✅ Você completou a **Missão ${numero}**!\n\n💵 **Recompensa:** ${formatBalance(reward)}\n💰 **Novo saldo:** ${formatBalance(newBalance)}`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setFooter({ text: "Continue completando as outras missões!" }),
      ],
    });
  }
}
