import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
  ComponentType,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance, randomBetween } from "../../lib/helpers.js";
import { getOrCreateUser, addBalance } from "../../lib/db.js";

const CUSTO = 250;

type Piece = [number, number];

function createPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) pieces.push([i, j]);
  return pieces.sort(() => Math.random() - 0.5);
}

function pieceStr([a, b]: Piece) { return `[${a}|${b}]`; }

function canPlay(piece: Piece, left: number, right: number): "left" | "right" | null {
  if (piece[0] === left || piece[1] === left) return "left";
  if (piece[0] === right || piece[1] === right) return "right";
  return null;
}

export const data = new SlashCommandBuilder()
  .setName("domino")
  .setDescription(`Jogue Dominó contra o bot! Custa ${CUSTO} Dólares para participar.`);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const user = await getOrCreateUser(interaction.user.id, interaction.guildId!, interaction.user.username);
  if (user.balance < CUSTO) {
    return interaction.editReply({ embeds: [errorEmbed("Saldo Insuficiente", `Você precisa de ${formatBalance(CUSTO)} para jogar Dominó.\nSeu saldo: ${formatBalance(user.balance)}`)] });
  }

  await addBalance(interaction.user.id, interaction.guildId!, -CUSTO, "game_entry", "Entrada no jogo Dominó");

  const allPieces = createPieces();
  let playerHand: Piece[] = allPieces.splice(0, 7);
  let botHand: Piece[] = allPieces.splice(0, 7);
  const boneyard = allPieces;

  const firstPiece = playerHand.find((p) => p[0] === p[1] && p[0] === Math.max(...playerHand.filter((x) => x[0] === x[1]).map((x) => x[0])));
  if (!firstPiece) {
    await addBalance(interaction.user.id, interaction.guildId!, CUSTO, "game_refund", "Reembolso dominó");
    return interaction.editReply({ embeds: [errorEmbed("Erro", "Não foi possível iniciar o jogo.")] });
  }

  playerHand = playerHand.filter((p) => p !== firstPiece);
  let board: Piece[] = [firstPiece];
  let leftEnd = firstPiece[0];
  let rightEnd = firstPiece[1];
  let passes = 0;
  let playedWell = true;

  const buildEmbed = () =>
    new EmbedBuilder()
      .setColor(0x8e44ad)
      .setTitle("🁣 Dominó!")
      .addFields(
        { name: "Mesa", value: board.map(pieceStr).join(" ") || "Vazia", inline: false },
        { name: "Extremidades", value: `⬅️ **${leftEnd}** | **${rightEnd}** ➡️`, inline: true },
        { name: "Peças do Bot", value: `${botHand.length} peça(s)`, inline: true },
        { name: "Sua Mão", value: playerHand.map(pieceStr).join("  ") || "Sem peças!" },
        { name: "Estoque", value: `${boneyard.length} peça(s) disponíveis`, inline: true },
      );

  const buildButtons = () => {
    const playable = playerHand
      .map((p, i) => ({ piece: p, idx: i, side: canPlay(p, leftEnd, rightEnd) }))
      .filter((x) => x.side !== null);

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < Math.min(playable.length, 10); i += 4) {
      const chunk = playable.slice(i, i + 4);
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          chunk.map((x) =>
            new ButtonBuilder()
              .setCustomId(`dom_play_${x.idx}_${x.side}`)
              .setLabel(`${pieceStr(x.piece)} → ${x.side === "left" ? "⬅️" : "➡️"}`)
              .setStyle(ButtonStyle.Primary)
          )
        )
      );
    }

    const extraRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("dom_draw").setLabel("🃏 Comprar do Estoque").setStyle(ButtonStyle.Secondary).setDisabled(boneyard.length === 0),
      new ButtonBuilder().setCustomId("dom_pass").setLabel("⏭️ Passar").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("dom_quit").setLabel("❌ Desistir").setStyle(ButtonStyle.Danger),
    );
    rows.push(extraRow);
    return rows.slice(0, 5);
  };

  const msg = await interaction.editReply({ embeds: [buildEmbed()], components: buildButtons() });
  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 180000 });

  collector.on("collect", async (btn: ButtonInteraction) => {
    if (btn.user.id !== interaction.user.id) { await btn.reply({ content: "Não é a sua partida!", ephemeral: true }); return; }
    await btn.deferUpdate();

    if (btn.customId === "dom_quit") { collector.stop("quit"); return; }

    if (btn.customId === "dom_draw") {
      if (boneyard.length > 0) { playerHand.push(boneyard.splice(0, 1)[0]); playedWell = false; passes = 0; }
    } else if (btn.customId === "dom_pass") {
      passes++;
      if (passes >= 3) { collector.stop("stall"); return; }
    } else if (btn.customId.startsWith("dom_play_")) {
      const parts = btn.customId.split("_");
      const idx = parseInt(parts[2]);
      const side = parts[3] as "left" | "right";
      const piece = playerHand[idx];
      playerHand.splice(idx, 1);

      if (side === "left") {
        if (piece[1] === leftEnd) board.unshift(piece);
        else board.unshift([piece[1], piece[0]]);
        leftEnd = board[0][0];
      } else {
        if (piece[0] === rightEnd) board.push(piece);
        else board.push([piece[1], piece[0]]);
        rightEnd = board[board.length - 1][1];
      }
      passes = 0;

      if (playerHand.length === 0) { collector.stop("win"); return; }
    }

    let botPlayed = false;
    for (let i = 0; i < botHand.length; i++) {
      const side = canPlay(botHand[i], leftEnd, rightEnd);
      if (side) {
        const piece = botHand.splice(i, 1)[0];
        if (side === "left") { board.unshift(piece[1] === leftEnd ? piece : [piece[1], piece[0]]); leftEnd = board[0][0]; }
        else { board.push(piece[0] === rightEnd ? piece : [piece[1], piece[0]]); rightEnd = board[board.length - 1][1]; }
        botPlayed = true;
        break;
      }
    }
    if (!botPlayed && boneyard.length > 0) botHand.push(boneyard.splice(0, 1)[0]);
    if (botHand.length === 0) { collector.stop("bot_win"); return; }

    await btn.editReply({ embeds: [buildEmbed()], components: buildButtons() });
  });

  collector.on("end", async (_, reason) => {
    const playerScore = playerHand.reduce((s, [a, b]) => s + a + b, 0);
    const botScore = botHand.reduce((s, [a, b]) => s + a + b, 0);
    const playerWon = reason === "win" || (reason === "stall" && playerScore <= botScore);

    let reward = 0;
    let resultMsg = "";

    if (playerWon) {
      reward = playedWell ? randomBetween(3000, 5000) : randomBetween(750, 3000);
      await addBalance(interaction.user.id, interaction.guildId!, reward, "game_win", "Vitória no Dominó");
      resultMsg = `🎉 **Você ganhou o Dominó!**\n💵 Prêmio: ${formatBalance(reward)}\n${!playedWell ? "*(Precisou de ajuda, prêmio reduzido)*" : ""}`;
    } else if (reason === "quit") {
      resultMsg = `❌ Você desistiu.\n💸 Perdeu: ${formatBalance(CUSTO)}`;
    } else {
      resultMsg = `😔 **Você perdeu!**\nSua pontuação: **${playerScore}** | Bot: **${botScore}**\n💸 Perdeu: ${formatBalance(CUSTO)}`;
    }

    const embed = new EmbedBuilder()
      .setColor(playerWon ? 0x2ecc71 : 0xe74c3c)
      .setTitle("🁣 Fim de Jogo — Dominó!")
      .setDescription(resultMsg)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
  });
}
