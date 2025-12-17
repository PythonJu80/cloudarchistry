/**
 * Elo Rating System for CloudArchistry Arena
 * Based on chess Elo with modifications for gaming
 */

// K-factor determines how much ratings change per game
// Higher K = more volatile ratings
const K_FACTOR = {
  NEW_PLAYER: 40,      // First 30 games
  INTERMEDIATE: 32,    // 30-100 games
  ESTABLISHED: 24,     // 100+ games
  MASTER: 16,          // 2400+ Elo
};

// Rank thresholds
export const RANKS = {
  BRONZE: { min: 0, max: 1199, name: "Bronze", color: "#CD7F32" },
  SILVER: { min: 1200, max: 1499, name: "Silver", color: "#C0C0C0" },
  GOLD: { min: 1500, max: 1799, name: "Gold", color: "#FFD700" },
  PLATINUM: { min: 1800, max: 2099, name: "Platinum", color: "#00CED1" },
  DIAMOND: { min: 2100, max: 2399, name: "Diamond", color: "#B9F2FF" },
  MASTER: { min: 2400, max: 9999, name: "Master", color: "#9400D3" },
};

/**
 * Get K-factor based on player's games and rating
 */
function getKFactor(totalGames: number, elo: number): number {
  if (elo >= 2400) return K_FACTOR.MASTER;
  if (totalGames < 30) return K_FACTOR.NEW_PLAYER;
  if (totalGames < 100) return K_FACTOR.INTERMEDIATE;
  return K_FACTOR.ESTABLISHED;
}

/**
 * Calculate expected score (probability of winning)
 * Returns value between 0 and 1
 */
function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate new Elo rating after a match
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  playerWon: boolean,
  isDraw: boolean,
  playerTotalGames: number
): number {
  const k = getKFactor(playerTotalGames, playerElo);
  const expected = expectedScore(playerElo, opponentElo);
  
  // Actual score: 1 for win, 0.5 for draw, 0 for loss
  let actual: number;
  if (isDraw) {
    actual = 0.5;
  } else {
    actual = playerWon ? 1 : 0;
  }
  
  // Elo change formula
  const change = Math.round(k * (actual - expected));
  
  return change;
}

/**
 * Calculate both players' Elo changes after a match
 */
export function calculateMatchEloChanges(
  player1Elo: number,
  player2Elo: number,
  player1TotalGames: number,
  player2TotalGames: number,
  winnerId: string | null,
  player1Id: string
): { player1Change: number; player2Change: number } {
  const isDraw = winnerId === null;
  const player1Won = winnerId === player1Id;
  
  const player1Change = calculateEloChange(
    player1Elo,
    player2Elo,
    player1Won,
    isDraw,
    player1TotalGames
  );
  
  const player2Change = calculateEloChange(
    player2Elo,
    player1Elo,
    !player1Won && !isDraw,
    isDraw,
    player2TotalGames
  );
  
  return { player1Change, player2Change };
}

/**
 * Get rank from Elo rating
 */
export function getRankFromElo(elo: number): { rank: string; tier: number; color: string } {
  let rankData = RANKS.BRONZE;
  
  if (elo >= RANKS.MASTER.min) rankData = RANKS.MASTER;
  else if (elo >= RANKS.DIAMOND.min) rankData = RANKS.DIAMOND;
  else if (elo >= RANKS.PLATINUM.min) rankData = RANKS.PLATINUM;
  else if (elo >= RANKS.GOLD.min) rankData = RANKS.GOLD;
  else if (elo >= RANKS.SILVER.min) rankData = RANKS.SILVER;
  
  // Calculate tier within rank (1 = highest, 3 = lowest)
  const rangeSize = (rankData.max - rankData.min + 1) / 3;
  const positionInRank = elo - rankData.min;
  const tier = 3 - Math.floor(positionInRank / rangeSize);
  
  return {
    rank: rankData.name,
    tier: Math.max(1, Math.min(3, tier)),
    color: rankData.color,
  };
}

/**
 * Format rank with tier (e.g., "Gold II")
 */
export function formatRank(rank: string, tier: number): string {
  const tierNumerals = ["I", "II", "III"];
  return `${rank} ${tierNumerals[tier - 1]}`;
}

/**
 * Calculate win rate percentage
 */
export function calculateWinRate(wins: number, totalGames: number): number {
  if (totalGames === 0) return 0;
  return Math.round((wins / totalGames) * 100);
}
