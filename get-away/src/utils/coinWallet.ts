import AsyncStorage from "@react-native-async-storage/async-storage";

/* ================================================================
   COIN WALLET – Persistent betting currency system
   ================================================================ */

const BALANCE_KEY = "@get-away-thulla/balance";
const HISTORY_KEY = "@get-away-thulla/transactions";

const WELCOME_BONUS = 10_000;
const MIN_BET = 1_000;
const MAX_BET = 100_000;
const LEAVE_PENALTY_MULTIPLE = 2;

/* ── Daily rewards (7-day streak) ─────────────────────────── */

export const DAILY_REWARDS = [1_000, 2_000, 3_000, 4_000, 5_000, 7_500, 10_000];
const REWARD_KEY = "@get-away-thulla/daily-reward";

export interface DailyRewardState {
  lastClaimDate: string; // "YYYY-MM-DD" (local)
  streak: number; // consecutive days claimed, 1..7
}

export interface DailyRewardStatus {
  streak: number;
  availableDay: number; // 1-7 day the player can claim today (0 if already claimed)
  claimed: boolean;
  claimedDay: number; // day index (1-7) claimed today, 0 if none
  nextDay: number; // upcoming day after completing the current cycle
}

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function loadDailyReward(): Promise<DailyRewardState> {
  try {
    const raw = await AsyncStorage.getItem(REWARD_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to default
  }
  return { lastClaimDate: "", streak: 0 };
}

export async function saveDailyReward(state: DailyRewardState): Promise<void> {
  await AsyncStorage.setItem(REWARD_KEY, JSON.stringify(state));
}

export async function getDailyRewardStatus(): Promise<DailyRewardStatus> {
  const state = await loadDailyReward();
  const today = dateStr();
  const yesterday = dateStr(-1);

  if (state.lastClaimDate === today) {
    return {
      streak: state.streak,
      availableDay: 0,
      claimed: true,
      claimedDay: state.streak,
      nextDay: (state.streak % 7) + 1,
    };
  }

  if (state.lastClaimDate === yesterday) {
    const availableDay = (state.streak % 7) + 1;
    return {
      streak: state.streak,
      availableDay,
      claimed: false,
      claimedDay: 0,
      nextDay: (availableDay % 7) + 1,
    };
  }

  // Missed a day (or first ever) → streak resets to day 1.
  return { streak: 0, availableDay: 1, claimed: false, claimedDay: 0, nextDay: 2 };
}

// Claims today's reward, advancing the streak. Missing a day resets to day 1.
// Returns the updated status and the amount added (0 if already claimed today).
export async function claimDailyReward(): Promise<{ status: DailyRewardStatus; amount: number; balance: number }> {
  const state = await loadDailyReward();
  const today = dateStr();
  const yesterday = dateStr(-1);

  const already = state.lastClaimDate === today;
  const consecutive = state.lastClaimDate === yesterday;
  let streak = state.streak;

  if (!already) {
    streak = consecutive ? (streak % 7) + 1 : 1;
  }

  const amount = already ? 0 : DAILY_REWARDS[streak - 1] ?? DAILY_REWARDS[0];

  const wallet = await loadBalance();
  const updatedWallet: WalletState = {
    ...wallet,
    balance: wallet.balance + amount,
  };
  await saveBalance(updatedWallet);
  if (!already && amount > 0) {
    await addTransaction({ type: "bonus", amount, description: `Daily reward — Day ${streak}` });
  }

  const updatedState: DailyRewardState = { lastClaimDate: today, streak };
  await saveDailyReward(updatedState);

  const status: DailyRewardStatus = {
    streak,
    availableDay: already ? 0 : 0,
    claimed: true,
    claimedDay: streak,
    nextDay: (streak % 7) + 1,
  };
  return { status, amount, balance: updatedWallet.balance };
}

export interface Transaction {
  id: string;
  type: "earn" | "spend" | "bet" | "win" | "penalty" | "bonus";
  amount: number;
  description: string;
  timestamp: number;
}

export interface WalletState {
  balance: number;
  hasReceivedBonus: boolean;
}

const DEFAULT_WALLET: WalletState = {
  balance: 0,
  hasReceivedBonus: false,
};

function txId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Core balance ────────────────────────────────────────── */

export async function loadBalance(): Promise<WalletState> {
  try {
    const raw = await AsyncStorage.getItem(BALANCE_KEY);
    if (raw) {
      return { ...DEFAULT_WALLET, ...JSON.parse(raw) };
    }
    return { ...DEFAULT_WALLET };
  } catch {
    return { ...DEFAULT_WALLET };
  }
}

export async function saveBalance(state: WalletState): Promise<void> {
  await AsyncStorage.setItem(BALANCE_KEY, JSON.stringify(state));
}

export async function getBalance(): Promise<number> {
  const state = await loadBalance();
  return state.balance;
}

/* ── Welcome bonus ───────────────────────────────────────── */

export async function claimWelcomeBonus(): Promise<number> {
  const state = await loadBalance();
  if (state.hasReceivedBonus) return state.balance;

  const updated: WalletState = {
    balance: state.balance + WELCOME_BONUS,
    hasReceivedBonus: true,
  };
  await saveBalance(updated);
  await addTransaction({
    type: "bonus",
    amount: WELCOME_BONUS,
    description: "Welcome bonus",
  });
  return updated.balance;
}

/* ── Deduct / Add ────────────────────────────────────────── */

export async function deduct(amount: number, description: string): Promise<{ ok: boolean; balance: number }> {
  const state = await loadBalance();
  if (state.balance < amount) {
    return { ok: false, balance: state.balance };
  }
  const updated: WalletState = { ...state, balance: state.balance - amount };
  await saveBalance(updated);
  await addTransaction({ type: "spend", amount, description });
  return { ok: true, balance: updated.balance };
}

export async function addCoins(amount: number, description: string): Promise<number> {
  const state = await loadBalance();
  const updated: WalletState = { ...state, balance: state.balance + amount };
  await saveBalance(updated);
  await addTransaction({ type: "earn", amount, description });
  return updated.balance;
}

/* ── Betting operations ──────────────────────────────────── */

export async function placeBet(amount: number): Promise<{ ok: boolean; balance: number }> {
  if (amount < MIN_BET) return { ok: false, balance: await getBalance() };
  return deduct(amount, `Bet placed: ${amount.toLocaleString()} coins`);
}

export async function awardWinnings(amount: number): Promise<number> {
  return addCoins(amount, `Won: ${amount.toLocaleString()} coins`);
}

export async function applyLeavePenalty(betAmount: number): Promise<number> {
  const penalty = betAmount * LEAVE_PENALTY_MULTIPLE;
  const state = await loadBalance();
  const actualPenalty = Math.min(penalty, state.balance);
  const updated: WalletState = { ...state, balance: state.balance - actualPenalty };
  await saveBalance(updated);
  await addTransaction({
    type: "penalty",
    amount: actualPenalty,
    description: `Left match early (-${actualPenalty.toLocaleString()} coins)`,
  });
  return updated.balance;
}

/* ── Transaction history ─────────────────────────────────── */

async function addTransaction(
  tx: Omit<Transaction, "id" | "timestamp">,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const list: Transaction[] = raw ? JSON.parse(raw) : [];
    list.unshift({ ...tx, id: txId(), timestamp: Date.now() });
    if (list.length > 100) list.length = 100;
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // silent
  }
}

export async function getTransactionHistory(): Promise<Transaction[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ── Constants ───────────────────────────────────────────── */

export { WELCOME_BONUS, MIN_BET, MAX_BET, LEAVE_PENALTY_MULTIPLE };
