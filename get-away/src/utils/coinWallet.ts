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
