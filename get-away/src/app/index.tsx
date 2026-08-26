import { useEffect, useRef, useState, useCallback } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Platform,
  BackHandler,
} from "react-native";
import type { ReactNode } from "react";
import Constants from "expo-constants";
import { io, Socket } from "socket.io-client";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  Layout,
} from "react-native-reanimated";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import type { MenuItem } from "@/components/HamburgerMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackSummary } from "@/components/FeedbackSummary";
import type { FeedbackStats } from "@/components/FeedbackSummary";
import { useSound } from "@/hooks/useSound";
import { loadStats, incrementStats } from "@/utils/gameStats";
import {
  createGame,
  playCard as enginePlay,
  playCpuTurn,
} from "@/game/gameEngine";
import type { GameState, GameCard, GamePlayer, Suit } from "@/game/gameEngine";
import {
  claimWelcomeBonus,
  getBalance,
  placeBet,
  awardWinnings,
  applyLeavePenalty,
  getTransactionHistory,
  MIN_BET,
  MAX_BET,
} from "@/utils/coinWallet";
import type { Transaction } from "@/utils/coinWallet";

/* ================================================================
   TYPES & CONSTANTS
   ================================================================ */

type Stage = "splash" | "onboarding" | "menu" | "lobby" | "game" | "settings" | "stats" | "howtoplay" | "betting";

/* ── Game helpers ───────────────────────────────────────── */

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
};
const SUIT_RED: Record<Suit, boolean> = {
  spades: false,
  hearts: true,
  clubs: false,
  diamonds: true,
};

function cardKey(c: GameCard): string {
  return c.id;
}

function getHumanPlayer(state: GameState): GamePlayer | undefined {
  return state.players.find((p) => p.id === "player-0");
}

function getLedSuit(state: GameState): Suit | null {
  if (!state.trick.length) return null;
  return state.trick[0].card.suit;
}

function getHumanPlayableIds(state: GameState): Set<string> {
  const human = getHumanPlayer(state);
  if (!human) return new Set();
  const ledSuit = getLedSuit(state);
  const ledCards = ledSuit
    ? human.hand.filter((c) => c.suit === ledSuit)
    : [];
  const playable = ledCards.length ? ledCards : human.hand;
  return new Set(playable.map((c) => c.id));
}

/* ================================================================
   ANIMATED PRESSABLE
   ================================================================ */

function AnimatedPressable({
  onPress,
  children,
  className = "",
  style,
  disabled = false,
}: {
  onPress?: () => void;
  children: ReactNode;
  className?: string;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      disabled={disabled}
    >
      <Animated.View style={[animStyle, style]} className={className}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ================================================================
   FLOATING DECOR CARD
   ================================================================ */

function FloatingDecorCard({
  symbol,
  x,
  y,
  rotation,
  delay,
}: {
  symbol: string;
  x: string;
  y: string;
  rotation: number;
  delay: number;
}) {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-8, {
          duration: 2200 + delay * 0.5,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[animatedStyle, { position: "absolute", left: x as any, top: y as any }]}
      className="w-12 h-16 rounded-lg border border-white/5 items-center justify-center"
      pointerEvents="none"
    >
      <Text className="text-white/10 text-2xl">{symbol}</Text>
    </Animated.View>
  );
}

/* ================================================================
   CARD BACK – Consistent card-back rendering
   ================================================================ */

function CardBack({
  width,
  height,
  className = "",
}: {
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <View
      className={`rounded-[12px] overflow-hidden border border-aqua/20 ${className}`}
      style={{
        width,
        height,
        backgroundColor: "#1B6672",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      {/* Base teal fill */}
      <View
        className="absolute inset-0"
        style={{ backgroundColor: "#1B6672" }}
      />
      {/* Geometric pattern overlay */}
      <View className="absolute inset-0 opacity-20">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 4 }).map((_, col) => (
            <View
              key={`${row}-${col}`}
              className="absolute border border-aqua/30"
              style={{
                width: width * 0.35,
                height: height * 0.2,
                left: `${12 + col * 22}%`,
                top: `${8 + row * 15}%`,
                borderRadius: 3,
                transform: [{ rotate: "45deg" }],
              }}
            />
          )),
        )}
      </View>
      {/* Center suit icon / logo placeholder */}
      <View className="absolute inset-0 items-center justify-center">
        <View className="bg-white/[0.08] rounded-full items-center justify-center border border-aqua/20"
          style={{ width: width * 0.45, height: width * 0.45 }}
        >
          <Text className="text-aqua text-lg font-black">✦</Text>
        </View>
      </View>
      {/* Subtle inner highlight for depth */}
      <View
        className="absolute inset-0 rounded-[12px]"
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      />
    </View>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function GameScreen() {
  const { width, height } = useWindowDimensions();
  const [stage, setStage] = useState<Stage>("splash");
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [showFeedback, setShowFeedback] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [currentBet, setCurrentBet] = useState(MIN_BET);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    gamesPlayed: 0,
    gamesWon: 0,
    loserCount: 0,
    thullaCount: 0,
    safeCount: 0,
    longestStreak: 0,
    favoriteCard: "—",
  });
  const { playButtonPress } = useSound();

  // Load persisted stats + coin balance on mount
  useEffect(() => {
    loadStats().then(setStats);
    claimWelcomeBonus().then(setCoinBalance);
    getTransactionHistory().then(setTransactions);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setStage("onboarding"), 1700);
    return () => clearTimeout(timer);
  }, []);

  const cardWidth = Math.max(42, Math.min(56, Math.max(width, height) * 0.07));

  /* ── Navigation ───────────────────────────────────────── */
  if (stage === "splash") return <SplashView />;
  if (stage === "onboarding")
    return (
      <OnboardingView
        page={onboardingPage}
        setPage={setOnboardingPage}
        onFinish={() => setStage("menu")}
      />
    );
  if (stage === "settings")
    return (
      <SettingsPage
        onBack={() => setStage("menu")}
      />
    );
  if (stage === "stats")
    return (
      <StatsPage
        stats={stats}
        transactions={transactions}
        coinBalance={coinBalance}
        onBack={() => setStage("menu")}
      />
    );
  if (stage === "howtoplay")
    return (
      <HowToPlayPage
        onBack={() => setStage("menu")}
      />
    );
  if (stage === "betting")
    return (
      <BettingPage
        coinBalance={coinBalance}
        currentBet={currentBet}
        setCurrentBet={setCurrentBet}
        onConfirm={() => setStage("game")}
        onBack={() => setStage("menu")}
      />
    );
  if (stage === "menu")
    return (
      <>
        <MenuView
          coinBalance={coinBalance}
          onPlay={(playerCount) => {
            playButtonPress();
            setSelectedPlayerCount(playerCount);
            setStage("betting");
          }}
          onFriends={() => {
            playButtonPress();
            setShowFeedback(true);
          }}
          onSettings={() => setStage("settings")}
          onStats={() => setStage("stats")}
          onHowToPlay={() => setStage("howtoplay")}
        />
        {/* Feedback Summary Modal – shown before going to lobby */}
        <FeedbackSummary
          visible={showFeedback}
          stats={stats}
          onClose={() => setShowFeedback(false)}
          onPlayWithFriends={() => {
            setShowFeedback(false);
            setStage("lobby");
          }}
        />
      </>
    );
  if (stage === "lobby")
    return (
      <FriendsLobby
        onStart={() => setStage("game")}
        onBack={() => setStage("menu")}
      />
    );

  return (
    <GameView
      cardWidth={cardWidth}
      playerCount={selectedPlayerCount}
      currentBet={currentBet}
      coinBalance={coinBalance}
      onLeave={async () => {
        const newBal = await applyLeavePenalty(currentBet);
        setCoinBalance(newBal);
        setStage("menu");
      }}
      onWin={async (amount) => {
        const newBal = await awardWinnings(amount);
        setCoinBalance(newBal);
      }}
      onStatsUpdate={setStats}
    />
  );
}

/* ================================================================
   SPLASH SCREEN
   ================================================================ */

function SplashView() {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [barWidth, setBarWidth] = useState(0);
  const shimmer = useSharedValue(0);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
    fadeAnim.value = withTiming(1, { duration: 1000 });
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1]) }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth * interpolate(progress.value, [0, 1], [0.05, 1]),
  }));

  const shimmerBorder = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.2, 0.5]),
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
      <View className="flex-1 bg-black">
        {/* ── Background Pattern ─────────────────────── */}
        <View className="absolute inset-0" pointerEvents="none">
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 5 }).map((_, col) => (
              <View
                key={`grid-${row}-${col}`}
                className="absolute border border-white/[0.02]"
                style={{
                  width: 160,
                  height: 140,
                  left: col * 160,
                  top: row * 140,
                }}
              />
            ))
          )}
          {/* Ambient glow */}
          <View
            className="absolute"
            style={{
              width: 500,
              height: 500,
              borderRadius: 250,
              backgroundColor: "rgba(111,224,208,0.03)",
              top: "50%",
              left: "40%",
              transform: [{ translateX: -250 }, { translateY: -250 }],
            }}
          />
        </View>

        {/* ── Main Content (Landscape) ──────────────── */}
        <View className="flex-1 flex-row items-center justify-center px-16 gap-20">
          {/* ── Card Assembly ────────────────────────── */}
          <Animated.View style={contentStyle}>
            <View style={{ width: 180, height: 260 }}>
              {/* Back card */}
              <View
                className="absolute rounded-[16px]"
                style={{
                  width: 170,
                  height: 250,
                  backgroundColor: "#0A0A0A",
                  borderWidth: 1,
                  borderColor: "rgba(111,224,208,0.1)",
                  transform: [{ rotate: "-8deg" }, { translateX: -18 }, { translateY: 5 }],
                }}
              >
                <View className="absolute inset-0 rounded-[16px] items-center justify-center opacity-15">
                  <Text className="text-[#6FE0D0] text-3xl">♠</Text>
                </View>
              </View>

              {/* Middle card */}
              <View
                className="absolute rounded-[16px]"
                style={{
                  width: 170,
                  height: 250,
                  backgroundColor: "#0A0A0A",
                  borderWidth: 1,
                  borderColor: "rgba(111,224,208,0.15)",
                  transform: [{ rotate: "5deg" }, { translateX: 8 }, { translateY: 3 }],
                }}
              >
                <View className="absolute inset-0 rounded-[16px] items-center justify-center opacity-20">
                  <Text className="text-[#F27C68] text-3xl">♦</Text>
                </View>
              </View>

              {/* Front card (hero) */}
              <View
                className="absolute rounded-[16px] items-center justify-center overflow-hidden"
                style={{
                  width: 180,
                  height: 260,
                  backgroundColor: "#0A0A0A",
                  borderWidth: 1.5,
                  borderColor: "rgba(111,224,208,0.2)",
                  shadowColor: "#6FE0D0",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.12,
                  shadowRadius: 24,
                  elevation: 12,
                }}
              >
                {/* Top accent line */}
                <View
                  className="absolute top-0 left-0 right-0"
                  style={{
                    height: 2,
                    backgroundColor: "#6FE0D0",
                    opacity: 0.3,
                  }}
                />

                {/* Center emblem */}
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    width: 72,
                    height: 72,
                    backgroundColor: "rgba(245,201,106,0.08)",
                    borderWidth: 1.5,
                    borderColor: "rgba(245,201,106,0.2)",
                  }}
                >
                  <Text className="text-[#F5C96A]" style={{ fontSize: 36 }}>
                    ✦
                  </Text>
                </View>

                {/* Decorative line */}
                <View
                  className="mt-4"
                  style={{
                    width: 36,
                    height: 1,
                    backgroundColor: "rgba(111,224,208,0.3)",
                  }}
                />

                {/* Bottom page indicator */}
                <View className="absolute bottom-4 left-0 right-0 items-center">
                  <Text className="text-white/20 text-[8px] tracking-[0.4em] font-medium">
                    LOADING
                  </Text>
                </View>

                {/* Shimmer overlay */}
                <Animated.View
                  style={[shimmerBorder, {
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(111,224,208,0.3)",
                  }]}
                  pointerEvents="none"
                />
              </View>
            </View>
          </Animated.View>

          {/* ── Text Content ─────────────────────────── */}
          <Animated.View style={fadeStyle} className="max-w-[340px]">
            <Text className="text-white/30 text-[10px] tracking-[0.4em] font-medium">
              WELCOME TO
            </Text>
            <Text className="text-white text-[36px] font-bold mt-3 leading-tight tracking-wider">
              GET WAY <Text className="text-[#6FE0D0]">CARDS</Text>
            </Text>
            <Text className="text-[#F5C96A]/70 text-[11px] tracking-[0.2em] font-medium mt-3">
              READ THE TABLE. FIND YOUR WAY OUT.
            </Text>

            {/* Progress bar */}
            <View className="mt-8 w-full max-w-[280px]">
              <View
                className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden"
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              >
                <Animated.View
                  style={barStyle}
                  className="h-full bg-[#6FE0D0] rounded-full"
                />
              </View>
              <Text className="text-white/25 text-[9px] tracking-[0.3em] font-medium mt-3">
                SHUFFLING THE DECK
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    );
}

/* ================================================================
   ONBOARDING SCREEN
   ================================================================ */

function OnboardingView({
  page,
  setPage,
  onFinish,
}: {
  page: number;
  setPage: (p: number) => void;
  onFinish: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const cardAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(0);

  const slides = [
    {
      kicker: "01",
      title: "READ THE TABLE",
      subtitle: "MATCH YOUR WAY OUT",
      body: "Play a card that shares the suit or rank of the discard pile.",
      symbol: "♠",
      accentColor: "#6FE0D0",
    },
    {
      kicker: "02",
      title: "OWN YOUR TURN",
      subtitle: "CHOOSE WITH PURPOSE",
      body: "Draw when you need a new option. Every card in your hand changes the table.",
      symbol: "♦",
      accentColor: "#F27C68",
    },
    {
      kicker: "03",
      title: "GET AWAY",
      subtitle: "EMPTY YOUR HAND",
      body: "Be the first to play every card and turn smart moves into a high score.",
      symbol: "★",
      accentColor: "#F5C96A",
    },
  ];
  const slide = slides[page];

  useEffect(() => {
    cardAnim.value = 0;
    fadeAnim.value = 0;
    cardAnim.value = withSpring(1, { damping: 20, stiffness: 90 });
    fadeAnim.value = withTiming(1, { duration: 600 });
  }, [page]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(cardAnim.value, [0, 1], [0.92, 1]) }],
    opacity: cardAnim.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [15, 0]) }],
  }));

  return (
      <View className="flex-1 bg-black">
        {/* ── Subtle Background Pattern ─────────────── */}
        <View className="absolute inset-0" pointerEvents="none">
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 4 }).map((_, col) => (
              <View
                key={`grid-${row}-${col}`}
                className="absolute border border-white/[0.02]"
                style={{
                  width: 160,
                  height: 140,
                  left: col * 160,
                  top: row * 140,
                }}
              />
            ))
          )}
          <View
            className="absolute"
            style={{
              width: 500,
              height: 500,
              borderRadius: 250,
              backgroundColor: `${slide.accentColor}06`,
              top: "50%",
              left: "35%",
              transform: [{ translateX: -250 }, { translateY: -250 }],
            }}
          />
        </View>

        {/* ── Top Bar ───────────────────────────────── */}
        <SafeAreaView>
          <View className="flex-row justify-between items-center px-8 pt-3 pb-2">
            <Text className="text-white/40 text-[11px] tracking-[0.3em] font-medium">
              GET WAY <Text className="text-white/60">CARDS</Text>
            </Text>
            <View className="flex-row items-center gap-1.5">
              {slides.map((_, i) => (
                <View
                  key={i}
                  className="rounded-full"
                  style={{
                    width: i === page ? 20 : 5,
                    height: 5,
                    backgroundColor: i === page ? slide.accentColor : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </View>
          </View>
        </SafeAreaView>

        {/* ── Main Content (Landscape) ──────────────── */}
        <View className="flex-1 flex-row items-center justify-center px-10 gap-16">
          {/* ── Card ──────────────────────────────── */}
          <Animated.View style={cardStyle}>
            <View
              className="rounded-[16px] overflow-hidden"
              style={{
                width: 180,
                height: 250,
                backgroundColor: "#0A0A0A",
                borderWidth: 1,
                borderColor: `${slide.accentColor}20`,
                shadowColor: slide.accentColor,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
                elevation: 12,
              }}
            >
              {/* Top accent line */}
              <View
                style={{
                  height: 2,
                  backgroundColor: slide.accentColor,
                  opacity: 0.4,
                }}
              />

              {/* Card content */}
              <View className="flex-1 items-center justify-center">
                <View
                  className="rounded-full items-center justify-center"
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: `${slide.accentColor}10`,
                    borderWidth: 1,
                    borderColor: `${slide.accentColor}25`,
                  }}
                >
                  <Text
                    style={{ color: slide.accentColor, fontSize: 36 }}
                  >
                    {slide.symbol}
                  </Text>
                </View>

                <View
                  className="mt-4"
                  style={{
                    width: 32,
                    height: 1,
                    backgroundColor: `${slide.accentColor}30`,
                  }}
                />
              </View>

              {/* Bottom page indicator */}
              <View className="absolute bottom-3 left-0 right-0 items-center">
                <Text className="text-white/25 text-[8px] tracking-[0.4em] font-medium">
                  {String(page + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Text Content ───────────────────────── */}
          <Animated.View style={textStyle} className="max-w-[320px]">
            <Text
              className="text-[10px] tracking-[0.4em] font-medium"
              style={{ color: slide.accentColor }}
            >
              STEP {slide.kicker}
            </Text>

            <Text className="text-white text-[26px] font-bold mt-3 leading-tight tracking-wide">
              {slide.title}
            </Text>

            <Text
              className="text-[12px] tracking-[0.2em] font-medium mt-2"
              style={{ color: `${slide.accentColor}90` }}
            >
              {slide.subtitle}
            </Text>

            <Text className="text-white/40 text-[13px] leading-5 mt-4">
              {slide.body}
            </Text>

            {/* ── Action Button ──────────────────────── */}
            <AnimatedPressable
              onPress={() =>
                page === slides.length - 1 ? onFinish() : setPage(page + 1)
              }
              className="mt-6 rounded-xl px-8 py-3 self-start"
              style={{
                backgroundColor: slide.accentColor,
                shadowColor: slide.accentColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Text className="text-black text-[11px] font-bold tracking-wider">
                {page === slides.length - 1 ? "GET STARTED" : "CONTINUE"}
              </Text>
            </AnimatedPressable>
          </Animated.View>
        </View>

        {/* ── SKIP Button – Hidden on last (third) slide ──── */}
        {page < slides.length - 1 && (
          <AnimatedPressable
            onPress={onFinish}
            className="absolute bottom-6 right-8"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text className="text-white/40 text-[11px] font-medium tracking-wider">
              SKIP
            </Text>
          </AnimatedPressable>
        )}
      </View>
    );
}

/* ================================================================
   MAIN MENU
   ================================================================ */

function MenuView({
  coinBalance,
  onPlay,
  onFriends,
  onSettings,
  onStats,
  onHowToPlay,
}: {
  coinBalance: number;
  onPlay: (playerCount: number) => void;
  onFriends: () => void;
  onSettings: () => void;
  onStats: () => void;
  onHowToPlay: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const headerGlow = useSharedValue(0);
  const shimmerX = useSharedValue(0);

  useEffect(() => {
    headerGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(headerGlow.value, [0, 1], [0.2, 0.5]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmerX.value, [0, 0.5, 1], [0.03, 0.08, 0.03]),
  }));

  /* ── Premium Feature Cards Data ─────────────────────── */
  const premiumFeatures = [
    {
      icon: "👑",
      label: "BATTLE PASS",
      title: "SEASON 1",
      desc: "Earn rewards as you play. Unlock exclusive card backs & themes.",
      accent: "#F5C96A",
      premium: false,
      onPress: () => {},
    },
    {
      icon: "🏆",
      label: "TOURNAMENT",
      title: "RANKED PLAY",
      desc: "Compete in weekly tournaments. Climb the leaderboard.",
      accent: "#6FE0D0",
      premium: true,
      onPress: () => {},
    },
    {
      icon: "🎨",
      label: "THEMES",
      title: "TABLE SKINS",
      desc: "Customize your felt. Unlock premium table designs.",
      accent: "#C084FC",
      premium: true,
      onPress: () => {},
    },
    {
      icon: "⚡",
      label: "DAILY",
      title: "CHALLENGES",
      desc: "Complete daily tasks for bonus XP and exclusive loot.",
      accent: "#FB923C",
      premium: false,
      onPress: () => {},
    },
  ];

  return (
      <View className="flex-1 bg-black">
        {/* ── Background ──────────────────────────────── */}
        <View className="absolute inset-0" pointerEvents="none">
          {/* Grid pattern */}
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 5 }).map((_, col) => (
              <View
                key={`grid-${row}-${col}`}
                className="absolute border border-white/[0.012]"
                style={{ width: 160, height: 140, left: col * 160, top: row * 140 }}
              />
            )),
          )}
          {/* Ambient gradient */}
          <View
            className="absolute"
            style={{
              width: 700, height: 700, borderRadius: 350,
              backgroundColor: "rgba(245,201,106,0.02)",
              top: "40%", left: "35%",
              transform: [{ translateX: -350 }, { translateY: -350 }],
            }}
          />
          <View
            className="absolute"
            style={{
              width: 500, height: 500, borderRadius: 250,
              backgroundColor: "rgba(111,224,208,0.015)",
              top: "20%", left: "60%",
              transform: [{ translateX: -250 }, { translateY: -250 }],
            }}
          />
          {/* Shimmer overlay */}
          <Animated.View
          style={[shimmerStyle, {
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(245,201,106,0.03)",
          }]}
        />
        </View>

        {/* ── Floating Cards ─────────────────────────── */}
        <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
          <FloatingDecorCard symbol="♠" x="4%" y="6%" rotation={15} delay={0} />
          <FloatingDecorCard symbol="♣" x="2%" y="82%" rotation={8} delay={500} />
          <FloatingDecorCard symbol="♦" x="90%" y="80%" rotation={-18} delay={100} />
        </View>

        <SafeAreaView className="flex-1">
          {/* ── Top Bar ───────────────────────────────── */}
          <View className="flex-row justify-between items-center px-8 pt-3 pb-2">
            <View className="flex-row items-center gap-3">
              <View
                className="rounded-full"
                style={{
                  width: 7, height: 7,
                  backgroundColor: "#F5C96A",
                  shadowColor: "#F5C96A",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9, shadowRadius: 5,
                }}
              />
              <Text className="text-white/40 text-[10px] tracking-[0.3em] font-medium">
                GET AWAY THULLA
              </Text>
              <View className="bg-gold/15 border border-gold/30 rounded-full px-2.5 py-0.5 ml-1">
                <Text className="text-gold text-[7px] tracking-widest font-black">
                  PRO
                </Text>
              </View>
            </View>
            <HamburgerMenu items={[
              { label: "Settings", icon: "⚙️", onPress: onSettings },
              { label: "Statistics", icon: "📊", onPress: onStats },
              { label: "How to Play", icon: "📖", onPress: onHowToPlay },
              { label: "Exit App", icon: "🚪", onPress: () => { if (Platform.OS === "android") BackHandler.exitApp(); }, destructive: true },
            ]} />
          </View>

          {/* ── Main Content (Landscape) ──────────────── */}
          <View className="flex-1 flex-row items-center justify-center px-8 gap-10">
            {/* ── Left Side: Hero Title ───────────────── */}
            <View className="flex-1 max-w-[380px]">
              {/* Title */}
              <View className="relative">
                <Animated.View style={[glowAnimStyle]} className="absolute -left-6 -top-6" pointerEvents="none">
                  <View style={{ width: 200, height: 80, borderRadius: 40, backgroundColor: "rgba(245,201,106,0.05)" }} />
                </Animated.View>
                <Text className="text-white/60 text-[11px] tracking-[0.4em] font-medium mb-2">
                  PREMIUM EDITION
                </Text>
                <Text className="text-white text-[38px] font-black tracking-wider leading-tight">
                  GET AWAY{"\n"}
                  <Text className="text-gold">THULLA</Text>
                </Text>
                <View className="flex-row items-center gap-2 mt-3">
                  <View className="h-[1px] w-8 bg-gold/30" />
                  <Text className="text-gold/50 text-[8px] tracking-[0.3em] font-medium">
                    CLASSIC CARD GAME
                  </Text>
                  <View className="h-[1px] flex-1 bg-gold/10" />
                </View>
              </View>

              {/* Coin Balance */}
              <View className="bg-gold/5 border border-gold/15 rounded-2xl px-5 py-3 mt-6 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-gold/10 border border-gold/25 items-center justify-center">
                  <Text className="text-gold text-lg">💰</Text>
                </View>
                <View>
                  <Text className="text-gold/40 text-[7px] tracking-[0.25em] font-black">YOUR BALANCE</Text>
                  <Text className="text-gold text-2xl font-black">{coinBalance.toLocaleString()}</Text>
                </View>
                <View className="ml-auto bg-gold/10 border border-gold/20 rounded-lg px-3 py-1.5">
                  <Text className="text-gold text-[8px] font-black tracking-wider">COINS</Text>
                </View>
              </View>

              {/* Footer */}
              <View className="mt-auto pt-4">
                <Text className="text-white/10 text-[7px] tracking-[0.3em] font-medium">
                  GET AWAY THULLA · PREMIUM EDITION · v1.0
                </Text>
              </View>
            </View>

            {/* ── Right Side: Mode Cards ──────────────── */}
            <View className="flex-1 max-w-[520px] gap-3">
              {/* ── PLAY VS CPU ─────────────────────── */}
              <AnimatedPressable
                onPress={() => setShowPlayerSelect(true)}
                className="rounded-[18px] overflow-hidden"
                style={{
                  shadowColor: "#F5C96A",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.12,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
                <View className="p-5 border border-gold/15" style={{ backgroundColor: "#0C0C0C", borderRadius: 18 }}>
                  <View className="absolute top-0 left-6 right-6 h-[1px]" style={{ backgroundColor: "#F5C96A", opacity: 0.3 }} />
                  <View className="absolute bottom-0 left-6 right-6 h-[1px]" style={{ backgroundColor: "#F5C96A", opacity: 0.08 }} />
                  <View className="flex-row items-center">
                    <View className="rounded-2xl items-center justify-center mr-5" style={{ width: 60, height: 76, backgroundColor: "rgba(245,201,106,0.06)", borderWidth: 1, borderColor: "rgba(245,201,106,0.15)" }}>
                      <Text className="text-gold text-[36px]">♠</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-gold/60 text-[8px] tracking-[0.3em] font-black">SOLO MATCH</Text>
                      <Text className="text-white text-[18px] font-black mt-1">PLAY VS CPU</Text>
                      <Text className="text-white/30 text-[11px] mt-1.5 leading-4">Challenge adaptive AI opponents across multiple difficulty levels.</Text>
                    </View>
                    <View className="rounded-full items-center justify-center" style={{ width: 40, height: 40, backgroundColor: "rgba(245,201,106,0.08)", borderWidth: 1, borderColor: "rgba(245,201,106,0.25)" }}>
                      <Text className="text-gold text-base font-black">→</Text>
                    </View>
                  </View>
                </View>
              </AnimatedPressable>

              {/* ── PLAY WITH FRIENDS ────────────────── */}
              <AnimatedPressable
                onPress={onFriends}
                className="rounded-[18px] overflow-hidden"
                style={{
                  shadowColor: "#6FE0D0",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.08,
                  shadowRadius: 20,
                  elevation: 8,
                }}
              >
                <View className="p-5 border border-aqua/10" style={{ backgroundColor: "#0C0C0C", borderRadius: 18 }}>
                  <View className="absolute top-0 left-6 right-6 h-[1px]" style={{ backgroundColor: "#6FE0D0", opacity: 0.2 }} />
                  <View className="flex-row items-center">
                    <View className="rounded-2xl items-center justify-center mr-5" style={{ width: 60, height: 76, backgroundColor: "rgba(111,224,208,0.05)", borderWidth: 1, borderColor: "rgba(111,224,208,0.12)" }}>
                      <Text className="text-aqua text-[36px]">♣</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-aqua/50 text-[8px] tracking-[0.3em] font-black">LOCAL TABLE</Text>
                      <Text className="text-white text-[18px] font-black mt-1">PLAY WITH FRIENDS</Text>
                      <Text className="text-white/30 text-[11px] mt-1.5 leading-4">Create a room and deal in with your crew on the same network.</Text>
                    </View>
                    <View className="rounded-full items-center justify-center" style={{ width: 40, height: 40, backgroundColor: "rgba(111,224,208,0.06)", borderWidth: 1, borderColor: "rgba(111,224,208,0.15)" }}>
                      <Text className="text-aqua/70 text-base font-black">→</Text>
                    </View>
                  </View>
                </View>
              </AnimatedPressable>

              {/* ── Premium Features Grid ────────────── */}
              <View className="flex-row gap-3 mt-1">
                {premiumFeatures.map((feat, i) => (
                  <AnimatedPressable
                    key={feat.label}
                    onPress={feat.onPress}
                    className="flex-1 rounded-2xl overflow-hidden"
                    style={{
                      shadowColor: feat.accent,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.06,
                      shadowRadius: 12,
                      elevation: 5,
                    }}
                  >
                    <View
                      className="p-3.5 border relative"
                      style={{
                        backgroundColor: "#0C0C0C",
                        borderRadius: 16,
                        borderColor: `${feat.accent}15`,
                      }}
                    >
                      {/* Premium badge */}
                      {feat.premium && (
                        <View className="absolute top-2 right-2 bg-gold/20 border border-gold/30 rounded-full px-1.5 py-0.5">
                          <Text className="text-gold text-[5px] tracking-wider font-black">PRO</Text>
                        </View>
                      )}
                      {/* Top accent */}
                      <View className="absolute top-0 left-4 right-4 h-[1px]" style={{ backgroundColor: feat.accent, opacity: 0.2 }} />
                      <Text className="text-lg">{feat.icon}</Text>
                      <Text className="text-white/40 text-[6px] tracking-[0.25em] font-black mt-2">{feat.label}</Text>
                      <Text className="text-white text-[11px] font-black mt-0.5">{feat.title}</Text>
                      <Text className="text-white/25 text-[8px] mt-1 leading-3">{feat.desc}</Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>

              {/* ── Utility Row ──────────────────────── */}
              <View className="flex-row gap-3 mt-1">
                <AnimatedPressable onPress={onSettings} className="flex-1 rounded-xl overflow-hidden">
                  <View className="flex-row items-center gap-3 px-4 py-3 border border-white/[0.04]" style={{ backgroundColor: "#0C0C0C", borderRadius: 14 }}>
                    <View className="rounded-lg items-center justify-center" style={{ width: 34, height: 34, backgroundColor: "rgba(245,201,106,0.05)", borderWidth: 1, borderColor: "rgba(245,201,106,0.1)" }}>
                      <Text className="text-gold text-xs">⚙</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white/20 text-[6px] tracking-[0.25em] font-black">PREFERENCES</Text>
                      <Text className="text-white text-[11px] font-black mt-0.5">SETTINGS</Text>
                    </View>
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={onStats} className="flex-1 rounded-xl overflow-hidden">
                  <View className="flex-row items-center gap-3 px-4 py-3 border border-white/[0.04]" style={{ backgroundColor: "#0C0C0C", borderRadius: 14 }}>
                    <View className="rounded-lg items-center justify-center" style={{ width: 34, height: 34, backgroundColor: "rgba(111,224,208,0.04)", borderWidth: 1, borderColor: "rgba(111,224,208,0.08)" }}>
                      <Text className="text-aqua text-xs">◆</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white/20 text-[6px] tracking-[0.25em] font-black">YOUR RECORD</Text>
                      <Text className="text-white text-[11px] font-black mt-0.5">STATISTICS</Text>
                    </View>
                  </View>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* ── Player Select Modal ───────────────────── */}
        {showPlayerSelect && (
          <View className="absolute inset-0 items-center justify-center z-50">
            <View className="absolute inset-0 bg-black/85" />
            <Animated.View
              entering={FadeIn.duration(250)}
              className="rounded-[24px] p-8 w-[340px] border border-gold/10"
              style={{
                backgroundColor: "#0A0A0A",
                shadowColor: "#F5C96A",
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.15,
                shadowRadius: 40,
                elevation: 25,
              }}
            >
              <View className="items-center">
                <View className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 items-center justify-center mb-3">
                  <Text className="text-gold text-xl">♠</Text>
                </View>
                <Text className="text-white text-xl font-black text-center">SELECT TABLE SIZE</Text>
                <Text className="text-white/25 text-[9px] tracking-[0.25em] text-center mt-1.5">CHOOSE HOW MANY PLAYERS</Text>
              </View>

              <View className="flex-row gap-3 mt-6 justify-center">
                {[3, 4, 5, 6].map((count) => (
                  <AnimatedPressable
                    key={count}
                    onPress={() => { setShowPlayerSelect(false); onPlay(count); }}
                    className="rounded-2xl items-center justify-center"
                    style={{
                      width: 64, height: 76,
                      backgroundColor: "rgba(245,201,106,0.04)",
                      borderWidth: 1,
                      borderColor: "rgba(245,201,106,0.15)",
                    }}
                  >
                    <Text className="text-white text-2xl font-black">{count}</Text>
                    <Text className="text-white/25 text-[6px] tracking-wider font-black mt-1">PLAYERS</Text>
                  </AnimatedPressable>
                ))}
              </View>

              <AnimatedPressable onPress={() => setShowPlayerSelect(false)} className="mt-5 py-2.5">
                <Text className="text-white/25 text-[10px] font-black text-center tracking-[0.2em]">CANCEL</Text>
              </AnimatedPressable>
            </Animated.View>
          </View>
        )}
      </View>
    );
}

/* ================================================================
   SETTINGS PAGE
   ================================================================ */

function SettingsPage({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const Toggle = ({
    value,
    onToggle,
  }: {
    value: boolean;
    onToggle: () => void;
  }) => (
    <Pressable
      onPress={onToggle}
      className="w-12 h-6 rounded-full items-center justify-center"
      style={{
        backgroundColor: value ? "rgba(245,201,106,0.2)" : "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: value ? "rgba(245,201,106,0.4)" : "rgba(255,255,255,0.08)",
      }}
    >
      <View
        className="w-5 h-5 rounded-full"
        style={{
          backgroundColor: value ? "#F5C96A" : "#333",
          transform: [{ translateX: value ? 10 : -10 }],
        }}
      />
    </Pressable>
  );

  const SettingRow = ({
    icon,
    title,
    subtitle,
    children,
  }: {
    icon: string;
    title: string;
    subtitle: string;
    children: ReactNode;
  }) => (
    <View
      className="flex-row items-center justify-between px-5 py-4 border border-white/[0.04]"
      style={{ backgroundColor: "#0C0C0C", borderRadius: 16 }}
    >
      <View className="flex-row items-center gap-4 flex-1">
        <View
          className="rounded-xl items-center justify-center"
          style={{
            width: 42,
            height: 42,
            backgroundColor: "rgba(245,201,106,0.04)",
            borderWidth: 1,
            borderColor: "rgba(245,201,106,0.08)",
          }}
        >
          <Text className="text-lg">{icon}</Text>
        </View>
        <View>
          <Text className="text-white text-[13px] font-black">{title}</Text>
          <Text className="text-white/25 text-[9px] mt-0.5">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 px-5 pt-3">
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={onBack} className="py-2 px-3 rounded-lg bg-gold/10 border border-gold/20">
            <Text className="text-gold text-sm font-black">← BACK</Text>
          </Pressable>
          <View>
            <Text className="text-white/40 text-[7px] tracking-[0.3em] font-black">PREFERENCES</Text>
            <Text className="text-white text-xl font-black">SETTINGS</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          <View className="gap-3">
            <SettingRow icon="🔊" title="Sound Effects" subtitle="Card sounds, banners & alerts">
              <Toggle value={soundEnabled} onToggle={() => setSoundEnabled(!soundEnabled)} />
            </SettingRow>
            <SettingRow icon="📳" title="Haptic Feedback" subtitle="Vibration on play & win">
              <Toggle value={hapticsEnabled} onToggle={() => setHapticsEnabled(!hapticsEnabled)} />
            </SettingRow>
            <SettingRow icon="🌙" title="Dark Mode" subtitle="Always on (premium feel)">
              <View className="bg-gold/15 border border-gold/25 rounded-lg px-2.5 py-1">
                <Text className="text-gold text-[8px] font-black">ON</Text>
              </View>
            </SettingRow>
            <SettingRow icon="🎵" title="Background Music" subtitle="Toggle lobby & table music">
              <Toggle value={false} onToggle={() => {}} />
            </SettingRow>
            <SettingRow icon="🔔" title="Notifications" subtitle="Tournament & challenge alerts">
              <Toggle value={true} onToggle={() => {}} />
            </SettingRow>
          </View>

          <View className="mt-8 mb-6">
            <Text className="text-white/15 text-[8px] tracking-[0.3em] font-black mb-3">ABOUT</Text>
            <View className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-5">
              <Text className="text-white text-sm font-black">GET AWAY THULLA</Text>
              <Text className="text-white/20 text-[10px] mt-1">Version 1.0.0 · Premium Edition</Text>
              <Text className="text-white/15 text-[9px] mt-3 leading-4">
                A classic South Asian card game reimagined with premium visuals, competitive betting, and online multiplayer.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ================================================================
   STATS PAGE
   ================================================================ */

function StatsPage({
  stats,
  transactions,
  coinBalance,
  onBack,
}: {
  stats: FeedbackStats;
  transactions: Transaction[];
  coinBalance: number;
  onBack: () => void;
}) {
  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;

  const StatCard = ({
    icon,
    label,
    value,
    accent,
  }: {
    icon: string;
    label: string;
    value: string | number;
    accent: string;
  }) => (
    <View
      className="flex-1 rounded-2xl p-4 border"
      style={{
        backgroundColor: "#0C0C0C",
        borderColor: `${accent}12`,
      }}
    >
      <View
        className="rounded-lg items-center justify-center mb-2"
        style={{
          width: 36,
          height: 36,
          backgroundColor: `${accent}08`,
          borderWidth: 1,
          borderColor: `${accent}15`,
        }}
      >
        <Text className="text-sm">{icon}</Text>
      </View>
      <Text className="text-white text-xl font-black">{value}</Text>
      <Text className="text-white/25 text-[7px] tracking-[0.2em] font-black mt-1">{label}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 px-5 pt-3">
        <View className="flex-row items-center gap-3 mb-5">
          <Pressable onPress={onBack} className="py-2 px-3 rounded-lg bg-gold/10 border border-gold/20">
            <Text className="text-gold text-sm font-black">← BACK</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-white/40 text-[7px] tracking-[0.3em] font-black">YOUR RECORD</Text>
            <Text className="text-white text-xl font-black">STATISTICS</Text>
          </View>
          <View className="bg-gold/10 border border-gold/20 rounded-xl px-3 py-1.5">
            <Text className="text-gold text-xs font-black">💰 {coinBalance.toLocaleString()}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* Win Rate Banner */}
          <View
            className="rounded-2xl p-5 mb-4 border border-gold/10"
            style={{ backgroundColor: "#0C0C0C" }}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white/30 text-[8px] tracking-[0.25em] font-black">WIN RATE</Text>
                <Text className="text-gold text-4xl font-black mt-1">{winRate}%</Text>
              </View>
              <View className="items-end">
                <Text className="text-white/30 text-[8px] tracking-[0.25em] font-black">LEVEL</Text>
                <Text className="text-white text-3xl font-black mt-1">
                  {Math.floor(stats.gamesPlayed / 5) + 1}
                </Text>
              </View>
            </View>
            <View className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
              <View
                className="h-full bg-gold rounded-full"
                style={{ width: `${Math.min(100, (stats.gamesPlayed % 5) * 20)}%` }}
              />
            </View>
            <Text className="text-white/20 text-[8px] mt-1.5">
              {5 - (stats.gamesPlayed % 5)} more wins to next level
            </Text>
          </View>

          {/* Stat Grid */}
          <View className="flex-row gap-2.5 mb-2.5">
            <StatCard icon="🎮" label="GAMES PLAYED" value={stats.gamesPlayed} accent="#F5C96A" />
            <StatCard icon="🏆" label="GAMES WON" value={stats.gamesWon} accent="#6FE0D0" />
          </View>
          <View className="flex-row gap-2.5 mb-2.5">
            <StatCard icon="💀" label="TIMES LOSER" value={stats.loserCount} accent="#F27C68" />
            <StatCard icon="⚠️" label="THULLAS HIT" value={stats.thullaCount} accent="#C084FC" />
          </View>
          <View className="flex-row gap-2.5 mb-4">
            <StatCard icon="✅" label="SAFE COUNT" value={stats.safeCount} accent="#6FE0D0" />
            <StatCard icon="🔥" label="BEST STREAK" value={stats.longestStreak} accent="#FB923C" />
          </View>

          {/* Recent Transactions */}
          <Text className="text-white/15 text-[8px] tracking-[0.3em] font-black mb-3">RECENT TRANSACTIONS</Text>
          <View className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-6">
            {transactions.length === 0 ? (
              <View className="p-6 items-center">
                <Text className="text-white/15 text-[10px]">No transactions yet. Play a game!</Text>
              </View>
            ) : (
              transactions.slice(0, 10).map((tx) => (
                <View
                  key={tx.id}
                  className="flex-row items-center justify-between px-4 py-3 border-b border-white/[0.03]"
                >
                  <View className="flex-1">
                    <Text className="text-white text-[11px] font-black">{tx.description}</Text>
                    <Text className="text-white/15 text-[8px] mt-0.5">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm font-black ${
                      tx.type === "win" || tx.type === "earn" || tx.type === "bonus"
                        ? "text-gold"
                        : "text-coral"
                    }`}
                  >
                    {tx.type === "win" || tx.type === "earn" || tx.type === "bonus" ? "+" : "-"}
                    {tx.amount.toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ================================================================
   HOW TO PLAY PAGE
   ================================================================ */

function HowToPlayPage({ onBack }: { onBack: () => void }) {
  const rules = [
    {
      icon: "🃏",
      title: "DEAL",
      desc: "Each player is dealt 8 cards from a standard 52-card deck. The remaining cards form the draw pile.",
    },
    {
      icon: "👑",
      title: "LEAD SUIT",
      desc: "The first player of each trick chooses the lead suit. All players must follow suit if they can.",
    },
    {
      icon: "⚠️",
      title: "THULLA",
      desc: "If you cannot follow the lead suit, you hit a THULLA! The trick winner collects all played cards.",
    },
    {
      icon: "✅",
      title: "SAFE",
      desc: "Empty your hand before everyone else to become SAFE. Safe players are eliminated from the loser count.",
    },
    {
      icon: "💀",
      title: "THE LOSER",
      desc: "The last player standing with cards in hand is the LOSER! They collect all remaining tricks.",
    },
    {
      icon: "💰",
      title: "BETTING",
      desc: "Place a bet before each game. Winner takes the pot. Leave early? You pay double the bet as penalty.",
    },
  ];

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 px-5 pt-3">
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable onPress={onBack} className="py-2 px-3 rounded-lg bg-gold/10 border border-gold/20">
            <Text className="text-gold text-sm font-black">← BACK</Text>
          </Pressable>
          <View>
            <Text className="text-white/40 text-[7px] tracking-[0.3em] font-black">RULES & GUIDE</Text>
            <Text className="text-white text-xl font-black">HOW TO PLAY</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {/* Hero */}
          <View className="rounded-2xl p-5 mb-5 border border-gold/10" style={{ backgroundColor: "#0C0C0C" }}>
            <Text className="text-gold text-2xl font-black">GET AWAY THULLA</Text>
            <Text className="text-white/30 text-[10px] mt-1 leading-4">
              A trick-taking card game where the goal is to empty your hand. The last player holding cards is the LOSER!
            </Text>
          </View>

          {/* Rules */}
          <View className="gap-3 mb-6">
            {rules.map((rule, i) => (
              <View
                key={i}
                className="flex-row gap-4 p-4 border border-white/[0.04] rounded-2xl"
                style={{ backgroundColor: "#0C0C0C" }}
              >
                <View
                  className="rounded-xl items-center justify-center"
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: "rgba(245,201,106,0.04)",
                    borderWidth: 1,
                    borderColor: "rgba(245,201,106,0.08)",
                  }}
                >
                  <Text className="text-xl">{rule.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gold text-[10px] tracking-[0.25em] font-black">{rule.title}</Text>
                  <Text className="text-white/40 text-[11px] mt-1 leading-4">{rule.desc}</Text>
                </View>
                <Text className="text-white/10 text-2xl font-black self-start">{i + 1}</Text>
              </View>
            ))}
          </View>

          {/* Tips */}
          <Text className="text-white/15 text-[8px] tracking-[0.3em] font-black mb-3">PRO TIPS</Text>
          <View className="bg-gold/5 border border-gold/10 rounded-2xl p-5 mb-6">
            <Text className="text-gold text-[11px] font-black mb-2">💡 STRATEGY</Text>
            <Text className="text-white/30 text-[10px] leading-5">
              • Count cards as they're played to know what's left{"\n"}
              • Lead with high cards early to force Thullas{"\n"}
              • Hold wild cards for critical moments{"\n"}
              • Watch which suits are exhausted — those are safe exits
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ================================================================
   BETTING PAGE
   ================================================================ */

function BettingPage({
  coinBalance,
  currentBet,
  setCurrentBet,
  onConfirm,
  onBack,
}: {
  coinBalance: number;
  currentBet: number;
  setCurrentBet: (v: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const presets = [1000, 2500, 5000, 10000];
  const canBet = coinBalance >= currentBet && currentBet >= MIN_BET;

  const adjustBet = (delta: number) => {
    const next = Math.max(MIN_BET, Math.min(MAX_BET, Math.min(coinBalance, currentBet + delta)));
    setCurrentBet(next);
  };

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 px-6 pt-3">
        <View className="flex-row items-center gap-3 mb-8">
          <Pressable onPress={onBack} className="py-2 px-3 rounded-lg bg-gold/10 border border-gold/20">
            <Text className="text-gold text-sm font-black">← BACK</Text>
          </Pressable>
          <View>
            <Text className="text-white/40 text-[7px] tracking-[0.3em] font-black">PLACE YOUR BET</Text>
            <Text className="text-white text-xl font-black">BETTING</Text>
          </View>
        </View>

        {/* Balance */}
        <View className="items-center mb-8">
          <Text className="text-white/25 text-[8px] tracking-[0.3em] font-black">YOUR BALANCE</Text>
          <Text className="text-gold text-4xl font-black mt-2">{coinBalance.toLocaleString()}</Text>
          <Text className="text-gold/30 text-[9px] tracking-wider mt-1">COINS</Text>
        </View>

        {/* Bet Amount */}
        <View className="items-center mb-8">
          <Text className="text-white/25 text-[8px] tracking-[0.3em] font-black mb-4">BET AMOUNT</Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => adjustBet(-500)}
              className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] items-center justify-center"
            >
              <Text className="text-white text-2xl font-black">−</Text>
            </Pressable>
            <View className="items-center bg-gold/5 border border-gold/15 rounded-2xl px-8 py-4">
              <Text className="text-gold text-4xl font-black">{currentBet.toLocaleString()}</Text>
              <Text className="text-gold/30 text-[8px] tracking-wider mt-1">COINS</Text>
            </View>
            <Pressable
              onPress={() => adjustBet(500)}
              className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] items-center justify-center"
            >
              <Text className="text-white text-2xl font-black">+</Text>
            </Pressable>
          </View>
        </View>

        {/* Presets */}
        <View className="flex-row gap-2.5 mb-8 justify-center">
          {presets.map((p) => (
            <Pressable
              key={p}
              onPress={() => setCurrentBet(Math.min(p, coinBalance))}
              className={`rounded-xl px-5 py-3 border ${
                currentBet === p ? "bg-gold/15 border-gold/30" : "bg-white/[0.03] border-white/[0.06]"
              }`}
            >
              <Text className={`text-sm font-black ${currentBet === p ? "text-gold" : "text-white/40"}`}>
                {p >= 1000 ? `${p / 1000}K` : p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Info */}
        <View className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-gold text-sm">⚠️</Text>
            <Text className="text-white/40 text-[9px] tracking-[0.2em] font-black">BETTING RULES</Text>
          </View>
          <Text className="text-white/20 text-[10px] leading-5">
            • Minimum bet: {MIN_BET.toLocaleString()} coins{"\n"}
            • Winner takes the full pot ({currentBet.toLocaleString()} coins){"\n"}
            • Leaving early costs 2x the bet ({(currentBet * 2).toLocaleString()} coins)
          </Text>
        </View>

        {/* Confirm Button */}
        <Pressable
          onPress={onConfirm}
          disabled={!canBet}
          className={`rounded-2xl py-4 items-center border ${
            canBet
              ? "bg-gold border-gold/40"
              : "bg-white/[0.04] border-white/[0.06]"
          }`}
          style={{
            shadowColor: canBet ? "#F5C96A" : "transparent",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: canBet ? 0.2 : 0,
            shadowRadius: 16,
          }}
        >
          <Text className={`text-sm font-black tracking-[0.2em] ${canBet ? "text-ink" : "text-white/20"}`}>
            {canBet ? `PLAY · BET ${currentBet.toLocaleString()} COINS` : "NOT ENOUGH COINS"}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/* ================================================================
   FRIENDS LOBBY
   ================================================================ */

type RoomPlayer = {
  id: string;
  displayName: string;
  isHost: boolean;
  status: string;
};

function FriendsLobby({
  onStart,
  onBack,
}: {
  onStart: () => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<"choose" | "create" | "join" | "waiting">(
    "choose",
  );
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomId, setRoomId] = useState("");
  const [code, setCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [name] = useState("Player");
  const [error, setError] = useState("");
  const socket = useRef<Socket | null>(null);
  const [playerId] = useState(
    () => `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  );

  const serverUrl =
    process.env.EXPO_PUBLIC_SERVER_URL ??
    (typeof window !== "undefined"
      ? `http://${window.location.hostname}:3001`
      : `http://${(Constants.expoConfig as any)?.hostUri?.split(":")[0] ?? "localhost"}:3001`);

  useEffect(
    () => () => {
      socket.current?.disconnect();
    },
    [],
  );

  const connect = (callback: (connection: Socket) => void) => {
    setError("");
    const connection = io(serverUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    });
    socket.current = connection;

    const connectTimeout = setTimeout(() => {
      if (!connection.connected) {
        connection.disconnect();
        setError("Cannot reach the server. Make sure the server is running.");
      }
    }, 10000);

    connection.on("connect", () => {
      clearTimeout(connectTimeout);
      callback(connection);
    });
    connection.on("connect_error", () => {
      clearTimeout(connectTimeout);
      setError("Connection failed. Check your network and try again.");
    });
    connection.on("room_updated", ({ room }) => {
      setRoomId(room.id);
      setRoomCode(room.inviteCode);
      setMaxPlayers(room.settings.maxPlayers);
      setPlayers(room.players);
      setView("waiting");
    });
    connection.on("join_success", ({ room }) => {
      setRoomId(room.id);
      setRoomCode(room.inviteCode);
      setMaxPlayers(room.settings.maxPlayers);
      setPlayers(room.players);
      setView("waiting");
    });
    connection.on("match_started", onStart);
    connection.on("error", ({ code }) =>
      setError(
        code === "ROOM_FULL"
          ? "This room is full."
          : code === "INVALID_CODE"
            ? "Room code not found."
            : "Unable to join this room.",
      ),
    );
  };

  const createRoom = () => {
    setError("");
    connect((connection) =>
      connection.emit("join_room", {
        roomId: `room_${playerId}`,
        playerId,
        displayName: name,
        settings: { maxPlayers },
      }),
    );
  };

  const joinRoom = () => {
    setError("");
    connect((connection) => {
      connection.once("found_room", ({ roomId }) =>
        connection.emit("join_room", { roomId, playerId, displayName: name }),
      );
      connection.emit("join_by_code", {
        code: code.trim().toUpperCase(),
        playerId,
      });
    });
  };

  if (view === "choose")
    return (
      <LobbyShell title="PLAY WITH FRIENDS" onBack={onBack}>
        <Text className="text-muted text-[10px] tracking-widest font-black">
          CREATE A TABLE OR JOIN ONE ALREADY IN PLAY.
        </Text>
        <View className="flex-row gap-4 mt-5">
          <AnimatedPressable
            onPress={() => setView("create")}
            className="flex-1 min-h-[190px] border border-white/20 rounded-xl bg-navy/80 p-[22px] justify-center"
          >
            <Text className="text-gold text-4xl font-light">＋</Text>
            <Text className="text-cloud text-[17px] font-black mt-3">
              CREATE YOUR OWN ROOM
            </Text>
            <Text className="text-white/50 text-xs leading-5 mt-2 max-w-[260px]">
              Choose the table size and invite friends with a room code.
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => setView("join")}
            className="flex-1 min-h-[190px] border border-white/20 rounded-xl bg-navy/80 p-[22px] justify-center"
          >
            <Text className="text-gold text-4xl font-light">↗</Text>
            <Text className="text-cloud text-[17px] font-black mt-3">
              JOIN A ROOM
            </Text>
            <Text className="text-white/50 text-xs leading-5 mt-2 max-w-[260px]">
              Enter a room number shared by the host on your network.
            </Text>
          </AnimatedPressable>
        </View>
      </LobbyShell>
    );

  if (view === "create")
    return (
      <LobbyShell title="CREATE ROOM" onBack={() => setView("choose")}>
        <Text className="text-muted text-[10px] tracking-widest font-black">
          HOW MANY PLAYERS AT THIS TABLE?
        </Text>
        <View className="flex-row gap-2.5 mt-5">
          {[2, 3, 4, 5, 6].map((count) => (
            <AnimatedPressable
              key={count}
              onPress={() => setMaxPlayers(count)}
              className={`w-[82px] h-[82px] border rounded-[9px] items-center justify-center ${
                count === maxPlayers
                  ? "bg-teal border-aqua"
                  : "bg-navy/80 border-white/20"
              }`}
            >
              <Text className="text-cloud text-[25px] font-black">{count}</Text>
              <Text className="text-muted text-[8px] font-black mt-0.5">
                PLAYERS
              </Text>
            </AnimatedPressable>
          ))}
        </View>
        <AnimatedPressable
          onPress={createRoom}
          className="self-start bg-gold rounded-lg px-6 py-3.5 mt-6"
        >
          <Text className="text-ink text-[11px] font-black tracking-wider">
            CREATE ROOM →
          </Text>
        </AnimatedPressable>
      </LobbyShell>
    );

  if (view === "join")
    return (
      <LobbyShell title="JOIN ROOM" onBack={() => setView("choose")}>
        <Text className="text-muted text-[10px] tracking-widest font-black">
          ENTER THE ROOM NUMBER FROM YOUR FRIEND.
        </Text>
        <TextInput
          value={code}
          onChangeText={(v) =>
            setCode(
              v
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6),
            )
          }
          placeholder="AB12CD"
          placeholderTextColor="#55737a"
          autoCapitalize="characters"
          maxLength={6}
          className="w-[270px] h-[62px] border border-aqua rounded-[9px] bg-navy/80 text-cloud text-[25px] tracking-widest text-center px-3.5 mt-5 font-black"
        />
        <AnimatedPressable
          onPress={joinRoom}
          disabled={code.length < 6}
          className={`self-start bg-gold rounded-lg px-6 py-3.5 mt-6 ${
            code.length < 6 ? "opacity-45" : ""
          }`}
        >
          <Text className="text-ink text-[11px] font-black tracking-wider">
            JOIN ROOM →
          </Text>
        </AnimatedPressable>
        {error ? (
          <Text className="text-coral text-[11px] mt-3">{error}</Text>
        ) : null}
      </LobbyShell>
    );

  return (
    <LobbyShell title="ROOM LOBBY" onBack={onBack}>
      <View className="bg-teal rounded-xl border border-aqua p-4 mt-5 self-stretch">
        <Text className="text-muted text-[10px] tracking-widest font-black">
          ROOM NUMBER
        </Text>
        <Text className="text-gold text-[34px] tracking-widest font-black mt-1">
          {roomCode || "------"}
        </Text>
        <Text className="text-white/50 text-[11px] mt-1">
          Share this code with players on your local network
        </Text>
      </View>
      <View className="flex-row justify-between items-center mt-5">
        <Text className="text-muted text-[10px] tracking-widest font-black">
          PLAYERS JOINED
        </Text>
        <Text className="text-gold text-base font-black">
          {players.length} / {maxPlayers}
        </Text>
      </View>
      <View className="mt-2.5 gap-1.5">
        {players.map((player) => (
          <View
            key={player.id}
            className="min-h-[42px] flex-row items-center px-3 rounded-[7px] bg-white/[0.06]"
          >
            <View className="w-7 h-7 rounded-full bg-aqua items-center justify-center">
              <Text className="text-ink font-black text-xs">
                {player.displayName[0]?.toUpperCase()}
              </Text>
            </View>
            <Text className="text-cloud text-xs font-extrabold ml-2.5">
              {player.displayName}
              {player.isHost ? "  · HOST" : ""}
            </Text>
            <Text className="text-aqua text-[9px] font-black ml-auto">
              {player.status === "active" ? "READY" : "JOINED"}
            </Text>
          </View>
        ))}
        {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map(
          (_, i) => (
            <View
              key={`empty-${i}`}
              className="min-h-[34px] border border-dashed border-white/10 rounded-[7px] justify-center px-3"
            >
              <Text className="text-white/20 text-[9px] font-black">
                WAITING FOR PLAYER {players.length + i + 1}
              </Text>
            </View>
          ),
        )}
      </View>
      <AnimatedPressable
        disabled={players.length < 2 || !roomId}
        onPress={() => socket.current?.emit("start_match", { roomId })}
        className={`self-start bg-gold rounded-lg px-6 py-3.5 mt-6 ${
          players.length < 2 || !roomId ? "opacity-45" : ""
        }`}
      >
        <Text className="text-ink text-[11px] font-black tracking-wider">
          {players.length < 2 ? "WAITING FOR PLAYERS" : "START MATCH  →"}
        </Text>
      </AnimatedPressable>
      {error ? (
        <Text className="text-coral text-[11px] mt-3">{error}</Text>
      ) : null}
    </LobbyShell>
  );
}

function LobbyShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-ink px-7 pt-4 pb-4">
      <View className="flex-row justify-between items-center">
        <Pressable onPress={onBack}>
          <Text className="text-gold text-[11px] font-black p-2.5">
            ← BACK
          </Text>
        </Pressable>
        <Text className="text-cloud text-base font-black tracking-wider">
          GET WAY CARDS
        </Text>
        <Text className="text-aqua text-[9px] tracking-widest font-black">
          MULTIPLAYER
        </Text>
      </View>
      <View className="flex-1 justify-center max-w-[900px] w-full self-center">
        <Text className="text-cloud text-[32px] font-black mb-2">{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

    /* ================================================================
    GAME VIEW – Full Table Layout
    ================================================================ */

function GameView({
  cardWidth,
  playerCount,
  currentBet,
  coinBalance,
  onLeave,
  onWin,
  onStatsUpdate,
}: {
  cardWidth: number;
  playerCount: number;
  currentBet: number;
  coinBalance: number;
  onLeave: () => void;
  onWin: (amount: number) => void;
  onStatsUpdate: (stats: FeedbackStats) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [gameState, setGameState] = useState<GameState>(() =>
    createGame(playerCount),
  );
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "thulla" | "safe" | "loser" | "info" } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageRef = useRef<string>("");
  const lastSafeRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    };
  }, []);

  const {
    playCardPlay,
    playTrickWon,
    playSafe,
    playLoser,
    playTurnChange,
    playGameOver,
    playButtonPress,
  } = useSound();

  const humanPlayer = getHumanPlayer(gameState);
  const humanHand = humanPlayer?.hand ?? [];
  const playableIds = getHumanPlayableIds(gameState);
  const ledSuit = getLedSuit(gameState);
  const isHumanTurn = gameState.currentPlayerId === "player-0" && gameState.phase === "playing";
  const isFinished = gameState.phase === "finished";

  const activePlayerCount = gameState.activePlayerIds.length;

  const gameMenuItems: MenuItem[] = [
    { label: "Settings", icon: "⚙️", onPress: () => {} },
    { label: "How to Play", icon: "📖", onPress: () => {} },
    {
      label: "Leave Table",
      icon: "🚪",
      onPress: () => setShowLeaveConfirm(true),
      destructive: true,
    },
  ];

  /* ── Banner display ──────────────────────────────────── */
  const showBanner = useCallback(
    (text: string, type: "thulla" | "safe" | "loser" | "info") => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setBanner({ text, type });
      bannerTimerRef.current = setTimeout(() => setBanner(null), 2200);
    },
    [],
  );

  /* ── Check for safe/loser after state changes ───────── */
  useEffect(() => {
    if (gameState.phase === "finished" && gameState.loserId) {
      const loser = gameState.players.find((p) => p.id === gameState.loserId);
      const humanIsLoser = gameState.loserId === "player-0";
      setTimeout(() => {
        showBanner(`${loser?.name ?? "Player"} is the LOSER!`, "loser");
        playLoser();
        if (!humanIsLoser) {
          onWin(currentBet);
        }
      }, 600);
      playGameOver();
      incrementStats({
        gamesPlayed: 1,
        gamesWon: humanIsLoser ? 0 : 1,
        loserCount: humanIsLoser ? 1 : 0,
      }).then((updated) => onStatsUpdate(updated));
    }
    const humanPlayer = gameState.players.find((p) => p.id === "player-0");
    if (humanPlayer?.safe && !lastSafeRef.current) {
      lastSafeRef.current = true;
      showBanner("You are SAFE!", "safe");
      playSafe();
      incrementStats({ safeCount: 1 }).then((updated) => onStatsUpdate(updated));
    }
  }, [gameState.phase]);

  /* ── Thulla detection from message ───────────────────── */
  useEffect(() => {
    if (gameState.message.includes("Thulla") && lastMessageRef.current !== gameState.message) {
      lastMessageRef.current = gameState.message;
      showBanner("THULLA!", "thulla");
      playTrickWon();
      incrementStats({ thullaCount: 1 }).then((updated) => onStatsUpdate(updated));
    }
  }, [gameState.message]);

  /* ── Turn change detection ────────────────────────────── */
  const lastPlayerIdRef = useRef<string>(gameState.currentPlayerId);

  useEffect(() => {
    const prevId = lastPlayerIdRef.current;
    lastPlayerIdRef.current = gameState.currentPlayerId;

    // Play turn change sound when it becomes human's turn (mid-trick)
    if (
      gameState.phase === "playing" &&
      gameState.currentPlayerId === "player-0" &&
      prevId !== "player-0" &&
      gameState.trick.length > 0
    ) {
      playTurnChange();
    }
  }, [gameState.currentPlayerId, gameState.phase, gameState.trick.length, playTurnChange]);

  /* ── CPU Auto-play ───────────────────────────────────── */
  useEffect(() => {
    if (cpuTimerRef.current) {
      clearTimeout(cpuTimerRef.current);
      cpuTimerRef.current = null;
    }

    if (
      gameState.phase === "playing" &&
      gameState.currentPlayerId !== "player-0"
    ) {
      cpuTimerRef.current = setTimeout(() => {
        setGameState((prev) => {
          if (prev.phase !== "playing" || prev.currentPlayerId === "player-0")
            return prev;
          return playCpuTurn(prev);
        });
      }, 800);
    }

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    };
  }, [gameState.currentPlayerId, gameState.phase]);

  /* ── Human card play ─────────────────────────────────── */
  const handlePlayCard = useCallback(
    (cardId: string) => {
      if (!isHumanTurn) return;
      if (!playableIds.has(cardId)) return;

      playCardPlay();
      setGameState((prev) => {
        const result = enginePlay(prev, "player-0", cardId);
        return result.error ? prev : result.state;
      });
    },
    [isHumanTurn, playableIds, playCardPlay],
  );

  /* ── New game ────────────────────────────────────────── */
  const startNewGame = useCallback(() => {
    playButtonPress();
    setGameState(createGame(playerCount));
    setBanner(null);
    lastMessageRef.current = "";
    lastSafeRef.current = false;
  }, [playerCount, playButtonPress]);

  /* ── Player position layout ──────────────────────────── */
  const getPlayerPositions = () => {
    const positions: Array<{
      id: string;
      name: string;
      x: number;
      y: number;
      isHuman: boolean;
      cardCount: number;
      safe: boolean;
    }> = [];

    const cx = width / 2;
    const cy = height / 2 - 10;
    const rx = width * 0.35;
    const ry = height * 0.28;

    gameState.players.forEach((player, index) => {
      const isHuman = player.id === "player-0";
      let x: number;
      let y: number;

      if (isHuman) {
        x = cx;
        y = height - 10;
      } else {
        const otherPlayers = gameState.players.filter((p) => p.id !== "player-0");
        const otherIndex = otherPlayers.indexOf(player);
        const totalOthers = otherPlayers.length;
        const startAngle = -Math.PI * 0.8;
        const endAngle = -Math.PI * 0.2;
        const angle =
          totalOthers === 1
            ? -Math.PI / 2
            : startAngle + (endAngle - startAngle) * (otherIndex / (totalOthers - 1));

        x = cx + Math.cos(angle) * rx;
        y = cy + Math.sin(angle) * ry;
      }

      positions.push({
        id: player.id,
        name: player.name,
        x,
        y,
        isHuman,
        cardCount: player.hand.length,
        safe: player.safe,
      });
    });

    return positions;
  };

  const playerPositions = getPlayerPositions();
  const cpuPositions = playerPositions.filter((p) => !p.isHuman);
  const humanPosition = playerPositions.find((p) => p.isHuman);

  const smallCardWidth = cardWidth * 0.65;

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView className="flex-1" style={{ flex: 1 }}>
        {/* ── Top Nav Bar ────────────────────────────── */}
        <View className="flex-row items-center justify-between px-4 py-1.5 bg-woodDark/90 border-b border-wood/50">
          <Pressable
            onPress={() => setShowLeaveConfirm(true)}
            className="py-2 px-3 rounded-lg bg-coral/15 border border-coral/30"
          >
            <Text className="text-coral text-sm font-black">← LEAVE</Text>
          </Pressable>
          <View className="items-center">
            <Text className="text-gold text-[9px] tracking-widest font-extrabold">
              GET AWAY THULLA · {playerCount} PLAYERS
            </Text>
            <Text className="text-cloud text-sm font-black" numberOfLines={1} ellipsizeMode="tail">
              {gameState.message}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="items-center bg-gold/10 rounded-lg px-2.5 py-0.5 border border-gold/20">
              <Text className="text-gold text-[8px] font-black">BET</Text>
              <Text className="text-gold text-sm font-black">
                {currentBet.toLocaleString()}
              </Text>
            </View>
            <View className="items-center bg-wood/40 rounded-lg px-2.5 py-0.5 border border-woodLight/30">
              <Text className="text-gold text-sm font-black">
                {gameState.discardCount}
              </Text>
              <Text className="text-woodLight text-[7px] tracking-widest font-extrabold">
                PILE
              </Text>
            </View>
            <HamburgerMenu items={gameMenuItems} />
          </View>
        </View>

        {/* ── Table Area ─────────────────────────────── */}
        <View className="flex-1 relative overflow-hidden">
          {/* Wood border frame */}
          <View
            className="absolute inset-1 rounded-[28px]"
            style={{
              borderWidth: 5,
              borderColor: "#5C3A1E",
              backgroundColor: "transparent",
              shadowColor: "#3D2512",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 15,
              elevation: 12,
            }}
          />

          {/* Inner felt table */}
          <View
            className="absolute inset-2 rounded-[22px] overflow-hidden"
            style={{
              backgroundColor: "#0E2B1A",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
            }}
          >
            {/* Felt texture overlay */}
            <View
              className="absolute inset-0"
              style={{
                backgroundColor: "#0E2B1A",
              }}
            />
            <View
              className="absolute inset-0"
              style={{
                backgroundColor: "rgba(30,90,50,0.3)",
              }}
            />
            {/* Subtle pattern */}
            <View className="absolute inset-0 opacity-[0.03]">
              {Array.from({ length: 40 }).map((_, i) => (
                <View
                  key={i}
                  className="absolute bg-white/10"
                  style={{
                    width: 1,
                    height: 1,
                    left: `${(i * 17) % 100}%`,
                    top: `${(i * 23) % 100}%`,
                  }}
                />
              ))}
            </View>

            {/* ── CPU Player Badges ─────────────────── */}
            {cpuPositions.map((pos) => (
              <PlayerBadge
                key={pos.id}
                name={pos.name}
                cardCount={pos.cardCount}
                isActive={gameState.currentPlayerId === pos.id}
                safe={pos.safe}
                x={pos.x - 40}
                y={pos.y - 16}
                small
              />
            ))}

            {/* ── Per-Player Trick Cards ──────────────── */}
            {gameState.trick.map((play) => {
              const playerPos = playerPositions.find((p) => p.id === play.playerId);
              if (!playerPos) return null;
              const isHuman = play.playerId === "player-0";
              const cardX = isHuman
                ? playerPos.x - smallCardWidth / 2
                : playerPos.x - smallCardWidth / 2;
              const cardY = isHuman
                ? playerPos.y - height * 0.36
                : playerPos.y + height * 0.14;
              return (
                <Animated.View
                  key={`${play.playerId}-${play.card.id}`}
                  entering={FadeIn.duration(300)}
                  layout={Layout.springify()}
                  className="absolute"
                  style={{
                    left: cardX,
                    top: cardY,
                  }}
                >
                  <MiniCard
                    card={play.card}
                    width={smallCardWidth}
                    playerName={
                      gameState.players.find((p) => p.id === play.playerId)
                        ?.name ?? "?"
                    }
                  />
                </Animated.View>
              );
            })}

            {/* ── Center Trick Zone (empty state) ────── */}
            {gameState.trick.length === 0 && (
              <View
                className="absolute items-center justify-center"
                style={{
                  left: width * 0.5 - 60,
                  top: height * 0.33 - 30,
                  width: 120,
                  height: 60,
                }}
              >
                <View className="w-12 h-[2px] bg-aqua/20 rounded-full" />
                <Text className="text-aqua/30 text-[8px] mt-1 font-black tracking-wider">
                  TRICK
                </Text>
                <View className="w-12 h-[2px] bg-aqua/20 rounded-full mt-1" />
              </View>
            )}

            {/* Lead Suit Indicator */}
            {ledSuit && gameState.trick.length > 0 && (() => {
              const leadPlay = gameState.trick[0];
              const leadPos = playerPositions.find((p) => p.id === leadPlay.playerId);
              const indicatorX = leadPos ? leadPos.x - 20 : width * 0.5 - 20;
              const indicatorY = leadPos
                ? (leadPos.isHuman ? leadPos.y - height * 0.36 - 45 : leadPos.y + height * 0.14 + smallCardWidth * 1.35 + 12)
                : height * 0.25;
              return (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  className="absolute items-center"
                  style={{ left: indicatorX, top: indicatorY }}
                >
                  <View className="bg-ink/70 rounded-full px-3 py-1 border border-aqua/30">
                    <Text
                      className={`text-lg font-black ${
                        SUIT_RED[ledSuit] ? "text-coral" : "text-cloud"
                      }`}
                    >
                      {SUIT_SYMBOL[ledSuit]}
                    </Text>
                  </View>
                  <Text className="text-aqua/60 text-[7px] font-black mt-0.5 tracking-wider">
                    LEAD
                  </Text>
                </Animated.View>
              );
            })()}

            {/* ── Discard Pile (right side) ─────────── */}
            <View
              className="absolute items-center"
              style={{ right: width * 0.08, top: height * 0.35 }}
            >
              <Text className="text-woodLight/60 text-[7px] font-black tracking-wider mb-1">
                DISCARD
              </Text>
              <View
                className="bg-woodDark/40 border border-wood/20 rounded-xl items-center justify-center"
                style={{
                  width: smallCardWidth + 16,
                  height: (smallCardWidth + 16) * 1.45,
                }}
              >
                <Text className="text-woodLight/30 text-[10px] font-black">
                  {gameState.discardCount}
                </Text>
                <Text className="text-woodLight/20 text-[7px]">
                  CARDS
                </Text>
              </View>
            </View>

            {/* ── Active Players Counter ────────────── */}
            <View
              className="absolute items-center"
              style={{ left: width * 0.08, top: height * 0.35 }}
            >
              <View className="bg-ink/50 rounded-xl px-3 py-2 border border-aqua/20 items-center">
                <Text className="text-aqua text-lg font-black">
                  {activePlayerCount}
                </Text>
                <Text className="text-aqua/50 text-[7px] font-black tracking-wider">
                  IN PLAY
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Human Player Hand ──────────────────────── */}
        <View
          className="bg-woodDark/95 border-t-2 border-wood/60"
          style={{ paddingBottom: Platform.OS === "ios" ? 8 : 12 }}
        >
          {/* Player badge row */}
          <View className="flex-row items-center justify-between px-4 py-1.5">
            <View className="flex-row items-center gap-2">
              <View className="w-7 h-7 rounded-full bg-teal items-center justify-center border border-aqua/50">
                <Text className="text-gold text-xs font-black">YOU</Text>
              </View>
              <View>
                <Text className="text-cloud text-[11px] font-black">
                  {humanPlayer?.name ?? "YOU"}
                </Text>
                <Text className="text-muted text-[8px] font-extrabold">
                  {humanHand.length} CARDS
                  {humanPlayer?.safe ? " · SAFE ✓" : ""}
                </Text>
              </View>
            </View>
            {isHumanTurn && gameState.phase === "playing" && (
              <Animated.View
                entering={FadeIn.duration(200)}
                className="bg-gold/20 rounded-lg px-3 py-1 border border-gold/40"
              >
                <Text className="text-gold text-[10px] font-black tracking-wider">
                  YOUR TURN
                </Text>
              </Animated.View>
            )}
            {!isHumanTurn && gameState.phase === "playing" && (
              <Text className="text-muted text-[9px] font-black">
                WAITING...
              </Text>
            )}
          </View>

          {/* Card hand */}
          {gameState.phase === "playing" ? (
            <ScrollView
              horizontal
              contentContainerStyle={{
                paddingHorizontal: Math.max(8, (width - humanHand.length * (cardWidth + 1)) / 2),
                paddingVertical: 2,
                alignItems: "flex-end",
                gap: 2,
              }}
              showsHorizontalScrollIndicator={false}
            >
              {humanHand.map((card) => {
                const isPlayable = playableIds.has(card.id);
                const dimmed = !isPlayable && isHumanTurn;

                return (
                  <Pressable
                    key={cardKey(card)}
                    onPress={() => isPlayable && handlePlayCard(card.id)}
                    disabled={!isPlayable}
                  >
                    <GameCardView
                      card={card}
                      width={cardWidth}
                      playable={isPlayable}
                      dimmed={dimmed}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            /* Game Over State */
            <View className="items-center py-3">
              <Text className="text-gold text-lg font-black">
                {gameState.loserId
                  ? gameState.loserId === "player-0"
                    ? "YOU ARE THE LOSER!"
                    : `${gameState.players.find((p) => p.id === gameState.loserId)?.name} IS THE LOSER!`
                  : "ROUND OVER"}
              </Text>
              {gameState.loserId && gameState.loserId !== "player-0" && (
                <View className="bg-gold/10 border border-gold/20 rounded-lg px-4 py-1.5 mt-2">
                  <Text className="text-gold text-xs font-black">
                    +{currentBet.toLocaleString()} COINS WON!
                  </Text>
                </View>
              )}
              <AnimatedPressable
                onPress={startNewGame}
                className="bg-gold rounded-xl px-8 py-3 mt-3"
              >
                <Text className="text-ink text-[11px] font-black tracking-wider">
                  PLAY AGAIN →
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* ── Status Banner ────────────────────────────── */}
      {banner && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0 items-center justify-center pointer-events-none z-50"
        >
          <View
            className={`px-8 py-5 rounded-2xl border-2 ${
              banner.type === "thulla"
                ? "bg-coral/90 border-coral"
                : banner.type === "safe"
                  ? "bg-teal/90 border-aqua"
                  : banner.type === "loser"
                    ? "bg-maroon/90 border-coral"
                    : "bg-ink/90 border-aqua/50"
            }`}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 15,
            }}
          >
            <Text
              className={`text-[28px] font-black tracking-wider text-center ${
                banner.type === "thulla"
                  ? "text-cloud"
                  : banner.type === "safe"
                    ? "text-gold"
                    : banner.type === "loser"
                      ? "text-coral"
                      : "text-cloud"
              }`}
            >
              {banner.type === "thulla" && "⚠ "}
              {banner.text}
              {banner.type === "thulla" && " ⚠"}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Leave Confirmation ───────────────────────── */}
      <ConfirmDialog
        visible={showLeaveConfirm}
        title="LEAVE TABLE?"
        message={`You will lose ${(currentBet * 2).toLocaleString()} coins as a penalty for leaving early. Your current bet of ${currentBet.toLocaleString()} coins will also be forfeited.`}
        confirmLabel={`LEAVE · PAY ${(currentBet * 2).toLocaleString()}`}
        cancelLabel="STAY"
        destructive
        onConfirm={() => {
          setShowLeaveConfirm(false);
          onLeave();
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </View>
  );
}

/* ================================================================
   PLAYER BADGE – Avatar, Name, Card Count, Turn Highlight
   ================================================================ */

function PlayerBadge({
  name,
  cardCount,
  isActive,
  safe,
  x,
  y,
  small = false,
}: {
  name: string;
  cardCount: number;
  isActive: boolean;
  safe: boolean;
  x: number;
  y: number;
  small?: boolean;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        pulseStyle,
        {
          position: "absolute",
          left: x,
          top: y,
        },
      ]}
      className="items-center"
    >
      <View
        className={`flex-row items-center gap-1.5 rounded-xl px-2 py-1 border ${
          isActive
            ? "bg-teal/90 border-gold"
            : safe
              ? "bg-teal/50 border-aqua/40"
              : "bg-ink/70 border-white/15"
        }`}
      >
        {/* Avatar */}
        <View
          className={`rounded-full items-center justify-center ${
            isActive ? "bg-gold" : "bg-aqua/80"
          }`}
          style={{
            width: small ? 22 : 26,
            height: small ? 22 : 26,
          }}
        >
          <Text
            className={`font-black ${
              isActive ? "text-ink" : "text-ink"
            }`}
            style={{ fontSize: small ? 9 : 10 }}
          >
            {name.slice(0, 2).toUpperCase()}
          </Text>
        </View>

        {/* Name */}
        <Text
          className={`font-black ${
            isActive ? "text-gold" : "text-cloud"
          }`}
          style={{ fontSize: small ? 9 : 10 }}
        >
          {name}
        </Text>

        {/* Card count badge */}
        <View
          className={`rounded-full items-center justify-center ${
            isActive ? "bg-gold/30" : "bg-white/15"
          }`}
          style={{
            width: small ? 18 : 22,
            height: small ? 18 : 22,
          }}
        >
          <Text
            className={`font-black ${
              isActive ? "text-gold" : "text-muted"
            }`}
            style={{ fontSize: small ? 8 : 9 }}
          >
            {cardCount}
          </Text>
        </View>

        {/* Safe indicator */}
        {safe && (
          <Text className="text-aqua text-[8px] font-black">✓</Text>
        )}
      </View>

      {/* Card backs showing */}
      {cardCount > 0 && (
        <View className="flex-row mt-0.5" style={{ gap: 1 }}>
          {Array.from({ length: Math.min(cardCount, 5) }).map((_, i) => (
            <View
              key={i}
              className="bg-teal border border-aqua/30 rounded-sm"
              style={{
                width: small ? 8 : 10,
                height: small ? 12 : 15,
              }}
            />
          ))}
          {cardCount > 5 && (
            <Text className="text-muted text-[7px] ml-0.5">+{cardCount - 5}</Text>
          )}
        </View>
      )}
    </Animated.View>
  );
}

/* ================================================================
   MINI CARD – Trick area card display (refactored with tokens)
   ================================================================ */

function MiniCard({
  card,
  width,
  playerName,
}: {
  card: GameCard;
  width: number;
  playerName: string;
}) {
  const isRed = SUIT_RED[card.suit];
  return (
    <View className="items-center">
      <View
        className={`rounded-lg p-1.5 border ${
          isRed
            ? "border-red-300"
            : "border-gray-300"
        }`}
        style={{
          width,
          height: width * 1.35,
          backgroundColor: isRed ? "#FFF5F5" : "#F8FAFC",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        {/* Subtle inner shadow for depth */}
        <View
          className="absolute inset-0 rounded-lg"
          style={{
            shadowColor: "#fff",
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.5,
            shadowRadius: 1,
          }}
        />
        <Text
          className={`font-black text-[8px] ${isRed ? "text-coral" : "text-ink"}`}
        >
          {card.rank}
          {SUIT_SYMBOL[card.suit]}
        </Text>
        <Text
          className={`text-[14px] self-center ${isRed ? "text-coral" : "text-muted"}`}
        >
          {SUIT_SYMBOL[card.suit]}
        </Text>
        {/* Faint watermark suit in center */}
        <Text
          className={`absolute self-center text-[22px] opacity-[0.06] font-black`}
          style={{ top: "35%" }}
        >
          {SUIT_SYMBOL[card.suit]}
        </Text>
      </View>
      <Text className="text-aqua/50 text-[6px] font-black mt-0.5">
        {playerName}
      </Text>
    </View>
  );
}

/* ================================================================
   GAME CARD VIEW – Playable indicators + dimmed state (refactored)
   ================================================================ */

function GameCardView({
  card,
  width,
  playable = false,
  dimmed = false,
}: {
  card: GameCard;
  width: number;
  playable?: boolean;
  dimmed?: boolean;
}) {
  const isRed = SUIT_RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];

  return (
    <View
      className={`mx-0.5 p-1.5 justify-between rounded-xl ${
        dimmed ? "opacity-50" : ""
      }`}
      style={{
        width,
        height: width * 1.45,
        backgroundColor: dimmed
          ? "#D1D5DB"
          : isRed
            ? "#FFF5F5"
            : "#F8FAFC",
        borderWidth: playable ? 2.5 : 1,
        borderColor: playable
          ? "#F5C96A"
          : dimmed
            ? "#9CA3AF"
            : "#E5E7EB",
        shadowColor: playable ? "#F5C96A" : "#000",
        shadowOffset: { width: 0, height: playable ? 2 : 1 },
        shadowOpacity: playable ? 0.4 : 0.12,
        shadowRadius: playable ? 10 : 3,
        elevation: playable ? 8 : 2,
      }}
    >
      {/* Gradient-like overlay for depth (white to slight off-white) */}
      <View
        className="absolute inset-0 rounded-xl opacity-40"
        style={{
          backgroundColor: isRed
            ? "rgba(255,245,245,0.4)"
            : "rgba(248,250,252,0.4)",
        }}
      />

      {/* Inner highlight border for depth */}
      <View
        className="absolute inset-[1px] rounded-[11px] pointer-events-none"
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.6)",
        }}
      />

      {/* Rank + Suit top-left */}
      <Text
        className={`font-black text-[11px] z-10 ${isRed ? "text-coral" : "text-ink"}`}
      >
        {card.rank}
        {symbol}
      </Text>

      {/* Faint suit watermark in center */}
      <Text
        className={`absolute self-center font-black opacity-[0.05] z-0 ${
          isRed ? "text-coral" : "text-muted"
        }`}
        style={{ fontSize: 32, top: "32%" }}
      >
        {symbol}
      </Text>

      {/* Center suit icon */}
      <Text
        className={`text-[22px] self-center z-10 ${isRed ? "text-coral" : "text-muted"}`}
      >
        {symbol}
      </Text>

      {/* Inverted Rank + Suit bottom-right */}
      <Text
        className={`font-black text-[11px] self-end z-10 ${isRed ? "text-coral" : "text-ink"}`}
        style={{ transform: [{ rotate: "180deg" }] }}
      >
        {card.rank}
        {symbol}
      </Text>

      {/* Playable indicator: gold glow shadow + subtle scale hint */}
      {playable && (
        <View
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            shadowColor: "#F5C96A",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 14,
          }}
        />
      )}

      {/* Dimmed state: subtle grayscale filter overlay */}
      {dimmed && (
        <View
          className="absolute inset-0 rounded-xl opacity-30 pointer-events-none"
          style={{
            backgroundColor: "#9CA3AF",
            shadowColor: "#9CA3AF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          }}
        />
      )}
    </View>
  );
}
