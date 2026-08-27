import { useEffect, useRef, useState, useCallback } from "react";
import {
  Pressable,
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
  playableCards,
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
   THEME
   ================================================================ */

const T = {
  bg: "#060F0A",
  surface: "#0C1B12",
  card: "#122B1A",
  cardLight: "#1A3526",
  felt: "#0C2416",
  accent: "#34D399",
  accentDim: "#166B44",
  gold: "#D4A843",
  goldBright: "#F5C96A",
  coral: "#E8605A",
  text: "#E8F5EE",
  textMuted: "#7CAA92",
  textDim: "#3A6B50",
  border: "#1A3526",
  borderLight: "#2A5038",
  navy: "#071525",
};

/* ================================================================
   RESPONSIVE HELPERS
   ================================================================ */

function rs(width: number, value: number): number {
  const factor = Math.min(width / 380, 1.25);
  return Math.round(value * factor);
}

function fs(width: number, value: number): number {
  const factor = Math.min(width / 380, 1.25);
  const scaled = value * factor;
  return Math.max(Math.round(scaled * 10) / 10, value * 0.6);
}

/* ================================================================
   TYPES & CONSTANTS
   ================================================================ */

type Stage =
  | "splash"
  | "onboarding"
  | "menu"
  | "lobby"
  | "game"
  | "settings"
  | "stats"
  | "howtoplay"
  | "betting";

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

function getHumanPlayer(state: GameState, humanId: string): GamePlayer | undefined {
  return state.players.find((p) => p.id === humanId);
}

function getLedSuit(state: GameState): Suit | null {
  if (!state.trick.length) return null;
  return state.trick[0].card.suit;
}

function getHumanPlayableIds(state: GameState, humanId: string): Set<string> {
  const human = getHumanPlayer(state, humanId);
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
  className: _className,
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
      style={[{ flex: 1 }, style]}
    >
      {children}
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
  const rotationAnim = useSharedValue(0);

  useEffect(() => {
    floatY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-12, {
          duration: 3000 + delay * 0.5,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    rotationAnim.value = withDelay(
      delay,
      withRepeat(
        withTiming(rotation > 0 ? rotation + 5 : rotation - 5, {
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${rotationAnim.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: "absolute",
          left: x as any,
          top: y as any,
          width: 48,
          height: 64,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "rgba(52,211,153,0.08)",
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
      pointerEvents="none"
    >
      <Text style={{ color: "rgba(52,211,153,0.12)", fontSize: 24 }}>
        {symbol}
      </Text>
    </Animated.View>
  );
}

/* ================================================================
   SPLASH SCREEN
   ================================================================ */

function SplashView() {
  const { width } = useWindowDimensions();
  const progress = useSharedValue(0);
  const fadeAnim = useSharedValue(0);
  const rotateAnim = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    fadeAnim.value = withDelay(300, withTiming(1, { duration: 800 }));
    rotateAnim.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [30, 0], {
          extrapolateRight: "clamp",
        }),
      },
    ],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Background Pattern */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => (
            <View
              key={`grid-${row}-${col}`}
              style={{
                position: "absolute",
                width: 160,
                height: 140,
                left: col * 160,
                top: row * 140,
                borderWidth: 1,
                borderColor: "rgba(52,211,153,0.025)",
              }}
            />
          )),
        )}
        <View
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: 250,
            backgroundColor: "rgba(52,211,153,0.025)",
            top: "50%",
            left: "40%",
            transform: [{ translateX: -250 }, { translateY: -250 }],
          }}
        />
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: rs(width, 40), gap: rs(width, 50) }}>
        {/* Card Assembly */}
        <Animated.View style={contentStyle}>
          <View style={{ width: rs(width, 120), height: rs(width, 170) }}>
            {/* Back card */}
            <View
              style={{
                position: "absolute",
                width: rs(width, 115),
                height: rs(width, 165),
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: "rgba(52,211,153,0.12)",
                borderRadius: rs(width, 10),
                transform: [{ rotate: "-8deg" }, { translateX: rs(width, -12) }, { translateY: 4 }],
              }}
            >
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: rs(width, 10), alignItems: "center", justifyContent: "center", opacity: 0.15 }}>
                <Text style={{ color: T.accent, fontSize: rs(width, 18) }}>♠</Text>
              </View>
            </View>
            {/* Middle card */}
            <View
              style={{
                position: "absolute",
                width: rs(width, 115),
                height: rs(width, 165),
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: "rgba(232,96,90,0.12)",
                borderRadius: rs(width, 10),
                transform: [{ rotate: "5deg" }, { translateX: rs(width, 6) }, { translateY: 2 }],
              }}
            >
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: rs(width, 10), alignItems: "center", justifyContent: "center", opacity: 0.15 }}>
                <Text style={{ color: T.coral, fontSize: rs(width, 18) }}>♦</Text>
              </View>
            </View>
            {/* Front card (hero) */}
            <View
              style={{
                position: "absolute",
                width: rs(width, 115),
                height: rs(width, 165),
                backgroundColor: T.card,
                borderWidth: 1,
                borderColor: "rgba(52,211,153,0.18)",
                borderRadius: rs(width, 10),
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                shadowColor: T.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
                elevation: 10,
              }}
            >
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", backgroundColor: "rgba(52,211,153,0.04)" }} />
              <View style={{ width: rs(width, 36), height: rs(width, 36), borderRadius: 999, backgroundColor: "rgba(52,211,153,0.1)", borderWidth: 1, borderColor: "rgba(52,211,153,0.25)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: T.accent, fontSize: rs(width, 16), fontWeight: "900" }}>♠</Text>
              </View>
              <Text style={{ color: T.accent, fontSize: rs(width, 24), fontWeight: "900", marginTop: rs(width, 8) }}>♠</Text>
              <View style={{ position: "absolute", bottom: rs(width, 10), left: 0, right: 0, alignItems: "center" }}>
                <Text style={{ color: "rgba(232,245,238,0.2)", fontSize: fs(width, 7), letterSpacing: 3, fontWeight: "500" }}>
                  GET AWAY THULLA
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[fadeStyle, { maxWidth: rs(width, 260) }]}>
          <Text style={{ color: "rgba(232,245,238,0.3)", fontSize: fs(width, 8), letterSpacing: 3, fontWeight: "500" }}>
            PREMIUM EDITION
          </Text>
          <Text style={{ color: T.text, fontSize: fs(width, 26), fontWeight: "900", marginTop: rs(width, 8), lineHeight: 32, letterSpacing: 2 }}>
            GET AWAY{"\n"}
            <Text style={{ color: T.gold }}>THULLA</Text>
          </Text>
          <Text style={{ color: "rgba(212,168,67,0.6)", fontSize: fs(width, 9), letterSpacing: 1.5, fontWeight: "500", marginTop: rs(width, 8) }}>
            CLASSIC CARD GAME · REIMAGINED
          </Text>
          <View style={{ marginTop: rs(width, 20), width: rs(width, 200) }}>
            <View style={{ width: "100%", height: 2, backgroundColor: T.border, borderRadius: 999, overflow: "hidden" }}>
              <Animated.View style={{ height: "100%", backgroundColor: T.accent, borderRadius: 999, width: "65%" }} />
            </View>
            <Text style={{ color: T.textDim, fontSize: fs(width, 7), letterSpacing: 2, fontWeight: "500", marginTop: rs(width, 8) }}>
              LOADING GAME ASSETS...
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/* ================================================================
   ONBOARDING VIEW
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
  const { width } = useWindowDimensions();
  const slides = [
    {
      accentColor: "#34D399",
      icon: "♠",
      title: "MASTER THE TRICK",
      subtitle: "Lead with your best cards. Every trick counts in the race to empty your hand.",
      detail: "Follow suit whenever you can. Breaking suit means you hit a Thulla — and you don't want that.",
    },
    {
      accentColor: "#D4A843",
      icon: "⚠",
      title: "AVOID THE THULLA",
      subtitle: "Can't follow suit? You hit a Thulla. Collect too many and you become the LOSER.",
      detail: "The player with the most Thulla cards at the end loses the round and forfeits their bet.",
    },
    {
      accentColor: "#34D399",
      icon: "🏆",
      title: "BET & WIN BIG",
      subtitle: "Place coins on the table. Outplay your opponents and take the entire pot.",
      detail: "Bigger bets mean bigger rewards — but leave early and you'll pay double as a penalty.",
    },
  ];
  const slide = slides[page] ?? slides[0];

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1, { damping: 14, stiffness: 180 }) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: withDelay(150, withSpring(1, { damping: 18, stiffness: 160 })),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Background glow */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <View
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: 200,
            backgroundColor: `${slide.accentColor}08`,
            top: "50%",
            left: "50%",
            transform: [{ translateX: -200 }, { translateY: -200 }],
          }}
        />
      </View>

      {/* Top Bar */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Text style={{ color: T.textMuted, fontSize: 9, letterSpacing: 2, fontWeight: "600" }}>
          GET AWAY <Text style={{ color: "rgba(232,245,238,0.6)" }}>THULLA</Text>
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                borderRadius: 999,
                width: i === page ? 18 : 5,
                height: 5,
                backgroundColor: i === page ? slide.accentColor : "rgba(232,245,238,0.15)",
              }}
            />
          ))}
        </View>
      </View>

      {/* Main Content - Vertical centered */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
        {/* Card */}
        <Animated.View style={cardStyle}>
          <View
            style={{
              width: 80,
              height: 112,
              backgroundColor: T.card,
              borderWidth: 1,
              borderColor: `${slide.accentColor}25`,
              borderRadius: 10,
              overflow: "hidden",
              shadowColor: slide.accentColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 10,
              alignSelf: "center",
            }}
          >
            <View style={{ height: 2, backgroundColor: slide.accentColor, opacity: 0.5 }} />
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: `${slide.accentColor}15`, borderWidth: 1, borderColor: `${slide.accentColor}30`, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18, color: slide.accentColor }}>{slide.icon}</Text>
              </View>
            </View>
            <View style={{ position: "absolute", bottom: 6, left: 0, right: 0, alignItems: "center" }}>
              <Text style={{ color: "rgba(232,245,238,0.25)", fontSize: 6, letterSpacing: 2, fontWeight: "700" }}>
                {slide.title}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[textStyle, { alignItems: "center", marginTop: 14, maxWidth: 320 }]}>
          <Text style={{ color: slide.accentColor, fontSize: 7, letterSpacing: 3, fontWeight: "700" }}>
            {slide.title}
          </Text>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: "900", marginTop: 6, textAlign: "center", lineHeight: 20, letterSpacing: 0.5 }}>
            {slide.subtitle}
          </Text>
          <Text style={{ color: T.textMuted, fontSize: 9, lineHeight: 14, marginTop: 8, textAlign: "center" }}>
            {slide.detail}
          </Text>

          {/* Button */}
          <Pressable
            onPress={() => {
              if (page < slides.length - 1) setPage(page + 1);
              else onFinish();
            }}
            style={{
              marginTop: 16,
              backgroundColor: slide.accentColor,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 28,
              shadowColor: slide.accentColor,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 8,
              minWidth: 160,
              alignItems: "center",
            }}
          >
            <Text style={{ color: T.bg, fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>
              {page < slides.length - 1 ? "CONTINUE" : "GET STARTED"}
            </Text>
          </Pressable>

          {page > 0 && page < slides.length - 1 && (
            <Pressable onPress={onFinish} style={{ marginTop: 10 }}>
              <Text style={{ color: "rgba(232,245,238,0.35)", fontSize: 9, fontWeight: "600", letterSpacing: 1 }}>
                SKIP INTRO
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
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
  const shimmer = useSharedValue(0);
  const glowAnim = useSharedValue(0.5);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.01, 0.04]),
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => (
            <View
              key={`grid-${row}-${col}`}
              style={{ position: "absolute", width: 160, height: 140, left: col * 160, top: row * 140, borderWidth: 1, borderColor: "rgba(52,211,153,0.015)" }}
            />
          )),
        )}
        <View style={{ position: "absolute", width: 700, height: 700, borderRadius: 350, backgroundColor: "rgba(52,211,153,0.02)", top: "40%", left: "35%", transform: [{ translateX: -350 }, { translateY: -350 }] }} />
        <View style={{ position: "absolute", width: 500, height: 500, borderRadius: 250, backgroundColor: "rgba(212,168,67,0.015)", top: "20%", left: "60%", transform: [{ translateX: -250 }, { translateY: -250 }] }} />
        <Animated.View style={[shimmerStyle, { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: T.accent }]} />
      </View>

      {/* Floating Cards */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }} pointerEvents="none">
        <FloatingDecorCard symbol="♠" x="4%" y="6%" rotation={15} delay={0} />
        <FloatingDecorCard symbol="♣" x="2%" y="82%" rotation={8} delay={500} />
        <FloatingDecorCard symbol="♦" x="90%" y="80%" rotation={-18} delay={100} />
      </View>

      <View style={{ flex: 1, paddingTop: rs(width, 8), paddingBottom: rs(width, 8), paddingLeft: rs(width, 12), paddingRight: rs(width, 12) }}>
        {/* Top Bar */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: rs(width, 32), paddingTop: rs(width, 12), paddingBottom: rs(width, 8) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(width, 12) }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: T.accent, shadowColor: T.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 5 }} />
            <Text style={{ color: "rgba(232,245,238,0.4)", fontSize: fs(width, 10), letterSpacing: 3, fontWeight: "500" }}>
              GET AWAY THULLA
            </Text>
            <View style={{ backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.25)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, marginLeft: 4 }}>
              <Text style={{ color: T.accent, fontSize: 7, letterSpacing: 2, fontWeight: "900" }}>PRO</Text>
            </View>
          </View>
          <HamburgerMenu items={[
            { label: "Settings", icon: "⚙️", onPress: onSettings },
            { label: "Statistics", icon: "📊", onPress: onStats },
            { label: "How to Play", icon: "📖", onPress: onHowToPlay },
            { label: "Exit App", icon: "🚪", onPress: () => { if (Platform.OS === "android") require("react-native").BackHandler?.exitApp(); }, destructive: true },
          ]} />
        </View>

        {/* Main Content */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: rs(width, 32), gap: rs(width, 40) }}>
          {/* Left Side */}
          <View style={{ flex: 1, maxWidth: rs(width, 380) }}>
            <View>
              <Animated.View style={[glowAnimStyle, { position: "absolute", left: -24, top: -24 }]} pointerEvents="none">
                <View style={{ width: 200, height: 80, borderRadius: 40, backgroundColor: "rgba(52,211,153,0.04)" }} />
              </Animated.View>
              <Text style={{ color: "rgba(232,245,238,0.5)", fontSize: fs(width, 11), letterSpacing: 4, fontWeight: "500", marginBottom: 8 }}>
                PREMIUM EDITION
              </Text>
              <Text style={{ color: T.text, fontSize: fs(width, 28), fontWeight: "900", letterSpacing: 2, lineHeight: 34 }}>
                GET AWAY{"\n"}
                <Text style={{ color: T.gold }}>THULLA</Text>
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                <View style={{ height: 1, width: 32, backgroundColor: "rgba(212,168,67,0.3)" }} />
                <Text style={{ color: "rgba(212,168,67,0.5)", fontSize: fs(width, 8), letterSpacing: 3, fontWeight: "500" }}>
                  CLASSIC CARD GAME
                </Text>
                <View style={{ height: 1, flex: 1, backgroundColor: "rgba(212,168,67,0.1)" }} />
              </View>
            </View>

            {/* Coin Balance */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(52,211,153,0.04)", borderWidth: 1, borderColor: "rgba(52,211,153,0.12)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 16 }}>
              <View style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>💰</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 2, fontWeight: "900" }}>YOUR BALANCE</Text>
                <Text style={{ color: T.gold, fontSize: 18, fontWeight: "900" }}>{coinBalance.toLocaleString()}</Text>
              </View>
              <View style={{ backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: T.accent, fontSize: 7, fontWeight: "900", letterSpacing: 1 }}>COINS</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={{ marginTop: "auto", paddingTop: 16 }}>
              <Text style={{ color: T.textDim, fontSize: 7, letterSpacing: 3, fontWeight: "500" }}>
                GET AWAY THULLA · PREMIUM EDITION · v1.0
              </Text>
            </View>
          </View>

          {/* Right Side: Mode Cards */}
          <View style={{ flex: 1, maxWidth: rs(width, 520), gap: rs(width, 12) }}>
            {/* PLAY VS CPU */}
            <AnimatedPressable
              onPress={() => setShowPlayerSelect(true)}
              style={{ borderRadius: 18, overflow: "hidden", shadowColor: T.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 }}
            >
              <View style={{ padding: rs(width, 14), borderWidth: 1, borderColor: "rgba(212,168,67,0.12)", backgroundColor: T.card, borderRadius: 14, position: "relative" }}>
                <View style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1, backgroundColor: T.gold, opacity: 0.3 }} />
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: rs(width, 44), height: rs(width, 56), borderRadius: 12, backgroundColor: "rgba(52,211,153,0.06)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)", alignItems: "center", justifyContent: "center", marginRight: rs(width, 14) }}>
                    <Text style={{ color: T.accent, fontSize: rs(width, 24) }}>♠</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textDim, fontSize: fs(width, 7), letterSpacing: 2.5, fontWeight: "900" }}>SOLO MATCH</Text>
                    <Text style={{ color: T.text, fontSize: fs(width, 14), fontWeight: "900", marginTop: 2 }}>PLAY VS CPU</Text>
                    <Text style={{ color: "rgba(232,245,238,0.3)", fontSize: fs(width, 9), marginTop: 4, lineHeight: 14 }}>Challenge adaptive AI opponents across difficulty levels.</Text>
                  </View>
                  <View style={{ width: rs(width, 28), height: rs(width, 28), borderRadius: 999, backgroundColor: "rgba(52,211,153,0.06)", borderWidth: 1, borderColor: "rgba(52,211,153,0.2)", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: T.accent, fontSize: 12, fontWeight: "900" }}>→</Text>
                  </View>
                </View>
              </View>
            </AnimatedPressable>

            {/* PLAY WITH FRIENDS */}
            <AnimatedPressable
              onPress={onFriends}
              style={{ borderRadius: 18, overflow: "hidden", shadowColor: T.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 8 }}
            >
              <View style={{ padding: rs(width, 14), borderWidth: 1, borderColor: "rgba(52,211,153,0.1)", backgroundColor: T.card, borderRadius: 14, position: "relative" }}>
                <View style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1, backgroundColor: T.accent, opacity: 0.2 }} />
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: rs(width, 44), height: rs(width, 56), borderRadius: 12, backgroundColor: "rgba(212,168,67,0.05)", borderWidth: 1, borderColor: "rgba(212,168,67,0.12)", alignItems: "center", justifyContent: "center", marginRight: rs(width, 14) }}>
                    <Text style={{ color: T.gold, fontSize: rs(width, 24) }}>♣</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "rgba(212,168,67,0.5)", fontSize: fs(width, 7), letterSpacing: 2.5, fontWeight: "900" }}>LOCAL TABLE</Text>
                    <Text style={{ color: T.text, fontSize: fs(width, 14), fontWeight: "900", marginTop: 2 }}>PLAY WITH FRIENDS</Text>
                    <Text style={{ color: "rgba(232,245,238,0.3)", fontSize: fs(width, 9), marginTop: 4, lineHeight: 14 }}>Create a room and deal in with your crew on the same network.</Text>
                  </View>
                  <View style={{ width: rs(width, 28), height: rs(width, 28), borderRadius: 999, backgroundColor: "rgba(212,168,67,0.06)", borderWidth: 1, borderColor: "rgba(212,168,67,0.15)", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "rgba(212,168,67,0.7)", fontSize: 12, fontWeight: "900" }}>→</Text>
                  </View>
                </View>
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>

      {/* Player Select Modal */}
      {showPlayerSelect && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)" }} />
          <Animated.View
            entering={FadeIn.duration(250)}
            style={{ borderRadius: 18, padding: rs(width, 20), width: rs(width, 280), borderWidth: 1, borderColor: "rgba(52,211,153,0.1)", backgroundColor: T.surface, shadowColor: T.accent, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 25 }}
          >
            <Pressable onPress={() => setShowPlayerSelect(false)} style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(212,168,67,0.12)", borderWidth: 1, borderColor: "rgba(212,168,67,0.25)", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <Text style={{ color: T.gold, fontSize: 12, fontWeight: "900" }}>✕</Text>
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: "rgba(52,211,153,0.1)", borderWidth: 1, borderColor: "rgba(52,211,153,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Text style={{ color: T.accent, fontSize: 16 }}>♠</Text>
              </View>
              <Text style={{ color: T.text, fontSize: 14, fontWeight: "900", textAlign: "center" }}>SELECT TABLE SIZE</Text>
              <Text style={{ color: T.textDim, fontSize: fs(width, 8), letterSpacing: 2, textAlign: "center", marginTop: 4 }}>CHOOSE HOW MANY PLAYERS</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "center" }}>
              {[3, 4, 5, 6].map((count) => (
                <AnimatedPressable
                  key={count}
                  onPress={() => { setShowPlayerSelect(false); onPlay(count); }}
                  style={{ width: rs(width, 50), height: rs(width, 60), borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(52,211,153,0.04)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}
                >
                  <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>{count}</Text>
                  <Text style={{ color: T.textDim, fontSize: 5, letterSpacing: 1, fontWeight: "900", marginTop: 2 }}>PLAYERS</Text>
                </AnimatedPressable>
              ))}
            </View>
            <AnimatedPressable onPress={() => setShowPlayerSelect(false)} style={{ marginTop: 12, paddingVertical: 6 }}>
              <Text style={{ color: T.textMuted, fontSize: 9, fontWeight: "900", textAlign: "center", letterSpacing: 2 }}>CANCEL</Text>
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

  const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <Pressable
      onPress={onToggle}
      style={{
        width: 48,
        height: 24,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: value ? "rgba(52,211,153,0.2)" : "rgba(232,245,238,0.05)",
        borderWidth: 1,
        borderColor: value ? "rgba(52,211,153,0.4)" : "rgba(232,245,238,0.08)",
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: value ? T.accent : "#333",
          transform: [{ translateX: value ? 10 : -10 }],
        }}
      />
    </Pressable>
  );

  const SettingRow = ({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children: ReactNode }) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: rs(width, 14), paddingVertical: rs(width, 10), borderWidth: 1, borderColor: "rgba(232,245,238,0.04)", backgroundColor: T.card, borderRadius: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.04)", borderWidth: 1, borderColor: "rgba(52,211,153,0.08)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <View>
          <Text style={{ color: T.text, fontSize: fs(width, 11), fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: T.textDim, fontSize: fs(width, 8), marginTop: 1 }}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingHorizontal: rs(width, 14), paddingTop: rs(width, 8) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rs(width, 14) }}>
        <View>
          <Text style={{ color: T.textDim, fontSize: fs(width, 6), letterSpacing: 2.5, fontWeight: "900" }}>PREFERENCES</Text>
          <Text style={{ color: T.text, fontSize: fs(width, 14), fontWeight: "900" }}>SETTINGS</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={{ gap: 8 }}>
          <SettingRow icon="🔊" title="Sound Effects" subtitle="Card sounds, banners & alerts">
            <Toggle value={soundEnabled} onToggle={() => setSoundEnabled(!soundEnabled)} />
          </SettingRow>
          <SettingRow icon="📳" title="Haptic Feedback" subtitle="Vibration on play & win">
            <Toggle value={hapticsEnabled} onToggle={() => setHapticsEnabled(!hapticsEnabled)} />
          </SettingRow>
          <SettingRow icon="🌙" title="Dark Mode" subtitle="Always on (premium feel)">
            <View style={{ backgroundColor: "rgba(52,211,153,0.1)", borderWidth: 1, borderColor: "rgba(52,211,153,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: T.accent, fontSize: fs(width, 8), fontWeight: "900" }}>ON</Text>
            </View>
          </SettingRow>
          <SettingRow icon="🎵" title="Background Music" subtitle="Toggle lobby & table music">
            <Toggle value={false} onToggle={() => {}} />
          </SettingRow>
          <SettingRow icon="🔔" title="Notifications" subtitle="Tournament & challenge alerts">
            <Toggle value={true} onToggle={() => {}} />
          </SettingRow>
        </View>

        <View style={{ marginTop: rs(width, 16), marginBottom: rs(width, 16) }}>
          <Text style={{ color: T.textDim, fontSize: fs(width, 7), letterSpacing: 2.5, fontWeight: "900", marginBottom: 8 }}>ABOUT</Text>
          <View style={{ backgroundColor: "rgba(232,245,238,0.02)", borderWidth: 1, borderColor: "rgba(232,245,238,0.04)", borderRadius: 12, padding: 14 }}>
            <Text style={{ color: T.text, fontSize: fs(width, 11), fontWeight: "900" }}>GET AWAY THULLA</Text>
            <Text style={{ color: T.textDim, fontSize: fs(width, 8), marginTop: 2 }}>Version 1.0.0 · Premium Edition</Text>
            <Text style={{ color: T.textMuted, fontSize: fs(width, 7), marginTop: 8, lineHeight: 13 }}>
              A classic South Asian card game reimagined with premium visuals, competitive betting, and online multiplayer.
            </Text>
          </View>
        </View>
      </ScrollView>
      <Pressable onPress={onBack} style={{ position: "absolute", bottom: 12, left: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}>
        <Text style={{ color: T.accent, fontSize: 12, fontWeight: "900" }}>← BACK</Text>
      </Pressable>
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
  const { width } = useWindowDimensions();
  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;
  const level = Math.floor(stats.gamesPlayed / 5) + 1;

  const statItems = [
    { icon: "🎮", label: "PLAYED", value: stats.gamesPlayed, color: T.gold },
    { icon: "🏆", label: "WON", value: stats.gamesWon, color: T.accent },
    { icon: "💀", label: "LOST", value: stats.loserCount, color: T.coral },
    { icon: "⚠️", label: "THULLAS", value: stats.thullaCount, color: "#C084FC" },
    { icon: "🛡️", label: "SAFE", value: stats.safeCount, color: T.accent },
    { icon: "🔥", label: "STREAK", value: stats.longestStreak, color: "#FB923C" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ color: T.text, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>STATISTICS</Text>
        <View style={{ backgroundColor: "rgba(212,168,67,0.1)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(212,168,67,0.2)" }}>
          <Text style={{ color: T.gold, fontSize: 9, fontWeight: "900" }}>💰 {coinBalance.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Win Rate + Level Bar */}
        <View style={{ flexDirection: "row", marginHorizontal: 10, marginTop: 8, gap: 6 }}>
          {/* Win Rate */}
          <View style={{ flex: 2, backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: "rgba(52,211,153,0.08)", padding: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 2, fontWeight: "900" }}>WIN RATE</Text>
                <Text style={{ color: T.gold, fontSize: 22, fontWeight: "900", marginTop: 1 }}>{winRate}%</Text>
              </View>
              <Text style={{ color: T.textDim, fontSize: 7 }}>{stats.gamesWon}W / {stats.gamesPlayed - stats.gamesWon}L</Text>
            </View>
            <View style={{ marginTop: 6, height: 4, backgroundColor: "rgba(232,245,238,0.05)", borderRadius: 999, overflow: "hidden" }}>
              <View style={{ height: "100%", backgroundColor: T.gold, borderRadius: 999, width: `${winRate}%` }} />
            </View>
          </View>
          {/* Level */}
          <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: "rgba(52,211,153,0.08)", padding: 10, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 2, fontWeight: "900" }}>LEVEL</Text>
            <Text style={{ color: T.accent, fontSize: 22, fontWeight: "900", marginTop: 1 }}>{level}</Text>
            <View style={{ marginTop: 4, height: 3, backgroundColor: "rgba(232,245,238,0.05)", borderRadius: 999, overflow: "hidden", width: "100%" }}>
              <View style={{ height: "100%", backgroundColor: T.accent, borderRadius: 999, width: `${(stats.gamesPlayed % 5) * 20}%` }} />
            </View>
            <Text style={{ color: T.textDim, fontSize: 5, marginTop: 2 }}>{5 - (stats.gamesPlayed % 5)} to next</Text>
          </View>
        </View>

        {/* Stat Grid - 3x2 compact */}
        <View style={{ marginHorizontal: 10, marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {statItems.map((item) => (
            <View key={item.label} style={{ width: "31.5%", backgroundColor: T.card, borderRadius: 6, borderWidth: 1, borderColor: `${item.color}12`, padding: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 10 }}>{item.icon}</Text>
              <Text style={{ color: item.color, fontSize: 14, fontWeight: "900", marginTop: 2 }}>{item.value}</Text>
              <Text style={{ color: T.textDim, fontSize: 5, letterSpacing: 1, fontWeight: "900", marginTop: 1 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Favorite Card */}
        {stats.favoriteCard !== "—" && (
          <View style={{ marginHorizontal: 10, marginTop: 6, backgroundColor: T.card, borderRadius: 6, borderWidth: 1, borderColor: "rgba(212,168,67,0.08)", padding: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 2, fontWeight: "900" }}>FAVORITE CARD</Text>
            <Text style={{ color: T.gold, fontSize: 12, fontWeight: "900" }}>{stats.favoriteCard}</Text>
          </View>
        )}

        {/* Transactions */}
        <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 2.5, fontWeight: "900", marginHorizontal: 10, marginTop: 10, marginBottom: 4 }}>RECENT TRANSACTIONS</Text>
        <View style={{ marginHorizontal: 10, marginBottom: 12, backgroundColor: T.card, borderRadius: 6, borderWidth: 1, borderColor: "rgba(232,245,238,0.04)", overflow: "hidden" }}>
          {transactions.length === 0 ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <Text style={{ color: T.textDim, fontSize: 8 }}>No transactions yet. Play a game!</Text>
            </View>
          ) : (
            transactions.slice(0, 8).map((tx, i) => (
              <View key={tx.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: i < transactions.length - 1 ? 1 : 0, borderBottomColor: "rgba(232,245,238,0.03)" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text, fontSize: 8, fontWeight: "800" }} numberOfLines={1}>{tx.description}</Text>
                  <Text style={{ color: T.textDim, fontSize: 6, marginTop: 1 }}>{new Date(tx.timestamp).toLocaleDateString()}</Text>
                </View>
                <Text style={{ fontSize: 9, fontWeight: "900", color: tx.type === "win" || tx.type === "earn" || tx.type === "bonus" ? T.gold : T.coral }}>
                  {tx.type === "win" || tx.type === "earn" || tx.type === "bonus" ? "+" : "-"}{tx.amount.toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <Pressable onPress={onBack} style={{ position: "absolute", bottom: 12, left: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}>
        <Text style={{ color: T.accent, fontSize: 12, fontWeight: "900" }}>← BACK</Text>
      </Pressable>
    </View>
  );
}

/* ================================================================
   HOW TO PLAY PAGE
   ================================================================ */

function HowToPlayPage({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const rules = [
    { icon: "🃏", title: "DEAL", desc: "Each player is dealt 8 cards from a standard 52-card deck. The remaining cards form the draw pile." },
    { icon: "👑", title: "LEAD SUIT", desc: "The first player of each trick chooses the lead suit. All players must follow suit if they can." },
    { icon: "⚠️", title: "THULLA", desc: "If you cannot follow the lead suit, you hit a THULLA! The trick winner collects all played cards." },
    { icon: "✅", title: "SAFE", desc: "Empty your hand before everyone else to become SAFE. Safe players are eliminated from the loser count." },
    { icon: "💀", title: "THE LOSER", desc: "The last player standing with cards in hand is the LOSER! They collect all remaining tricks." },
    { icon: "💰", title: "BETTING", desc: "Place a bet before each game. Winner takes the pot. Leave early? You pay double the bet as penalty." },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingHorizontal: rs(width, 14), paddingTop: rs(width, 8) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rs(width, 14) }}>
        <View>
          <Text style={{ color: T.textDim, fontSize: fs(width, 6), letterSpacing: 2.5, fontWeight: "900" }}>RULES & GUIDE</Text>
          <Text style={{ color: T.text, fontSize: fs(width, 14), fontWeight: "900" }}>HOW TO PLAY</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Hero */}
        <View style={{ borderRadius: 12, padding: rs(width, 14), marginBottom: 14, borderWidth: 1, borderColor: "rgba(52,211,153,0.08)", backgroundColor: T.card }}>
          <Text style={{ color: T.gold, fontSize: fs(width, 16), fontWeight: "900" }}>GET AWAY THULLA</Text>
          <Text style={{ color: T.textMuted, fontSize: fs(width, 8), marginTop: 6, lineHeight: 14 }}>
            A trick-taking card game where the goal is to empty your hand. The last player holding cards is the LOSER!
          </Text>
        </View>

        {/* Rules */}
        <View style={{ gap: 8, marginBottom: 16 }}>
          {rules.map((rule, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, padding: rs(width, 10), borderWidth: 1, borderColor: "rgba(232,245,238,0.04)", borderRadius: 12, backgroundColor: T.card }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.04)", borderWidth: 1, borderColor: "rgba(52,211,153,0.08)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>{rule.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.accent, fontSize: fs(width, 8), letterSpacing: 2, fontWeight: "900" }}>{rule.title}</Text>
                <Text style={{ color: T.textMuted, fontSize: fs(width, 8), marginTop: 2, lineHeight: 13 }}>{rule.desc}</Text>
              </View>
              <Text style={{ color: T.textDim, fontSize: fs(width, 14), fontWeight: "900", alignSelf: "flex-start" }}>{i + 1}</Text>
            </View>
          ))}
        </View>

        {/* Tips */}
        <Text style={{ color: T.textDim, fontSize: fs(width, 7), letterSpacing: 2.5, fontWeight: "900", marginBottom: 8 }}>PRO TIPS</Text>
        <View style={{ backgroundColor: "rgba(52,211,153,0.04)", borderWidth: 1, borderColor: "rgba(52,211,153,0.08)", borderRadius: 12, padding: rs(width, 14), marginBottom: 20 }}>
          <Text style={{ color: T.accent, fontSize: fs(width, 9), fontWeight: "900", marginBottom: 6 }}>💡 STRATEGY</Text>
          <Text style={{ color: T.textMuted, fontSize: fs(width, 8), lineHeight: 16 }}>
            • Count cards as they're played to know what's left{"\n"}
            • Lead with high cards early to force Thullas{"\n"}
            • Hold wild cards for critical moments{"\n"}
            • Watch which suits are exhausted — those are safe exits
          </Text>
        </View>
      </ScrollView>
      <Pressable onPress={onBack} style={{ position: "absolute", bottom: 12, left: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}>
        <Text style={{ color: T.accent, fontSize: 12, fontWeight: "900" }}>← BACK</Text>
      </Pressable>
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
  const { width } = useWindowDimensions();
  const presets = [1000, 2500, 5000, 10000];
  const canBet = coinBalance >= currentBet && currentBet >= MIN_BET;

  const adjustBet = (delta: number) => {
    const next = Math.max(MIN_BET, Math.min(MAX_BET, Math.min(coinBalance, currentBet + delta)));
    setCurrentBet(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ color: T.text, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>PLACE YOUR BET</Text>
        <View style={{ backgroundColor: "rgba(212,168,67,0.1)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(212,168,67,0.2)" }}>
          <Text style={{ color: T.gold, fontSize: 10, fontWeight: "900" }}>💰 {coinBalance.toLocaleString()}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, gap: 12 }}>
        {/* Pot visual */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: T.textDim, fontSize: 7, letterSpacing: 3, fontWeight: "900" }}>WIN POT</Text>
          <View style={{ marginTop: 4, backgroundColor: "rgba(52,211,153,0.06)", borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(52,211,153,0.2)", paddingVertical: 12, paddingHorizontal: 24, alignItems: "center" }}>
            <Text style={{ color: T.gold, fontSize: 30, fontWeight: "900" }}>{currentBet.toLocaleString()}</Text>
            <Text style={{ color: "rgba(212,168,67,0.4)", fontSize: 7, letterSpacing: 2, marginTop: 2 }}>COINS</Text>
          </View>
          <Text style={{ color: T.textDim, fontSize: 6, marginTop: 3 }}>Winner takes everything</Text>
        </View>

        {/* Bet adjuster */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 }}>
          <Pressable
            onPress={() => adjustBet(-500)}
            style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(232,245,238,0.05)", borderWidth: 1, borderColor: "rgba(232,245,238,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>−</Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 2, fontWeight: "900" }}>YOUR BET</Text>
            <Text style={{ color: T.gold, fontSize: 20, fontWeight: "900", marginTop: 2 }}>{currentBet.toLocaleString()}</Text>
          </View>
          <Pressable
            onPress={() => adjustBet(500)}
            style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(232,245,238,0.05)", borderWidth: 1, borderColor: "rgba(232,245,238,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>+</Text>
          </Pressable>
        </View>

        {/* Presets */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
          {presets.map((p) => (
            <Pressable
              key={p}
              onPress={() => setCurrentBet(Math.min(p, coinBalance))}
              style={{
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderWidth: 1,
                backgroundColor: currentBet === p ? "rgba(52,211,153,0.12)" : "rgba(232,245,238,0.03)",
                borderColor: currentBet === p ? "rgba(52,211,153,0.3)" : "rgba(232,245,238,0.06)",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "900", color: currentBet === p ? T.accent : T.textMuted }}>
                {p >= 1000 ? `${p / 1000}K` : p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Rules */}
        <View style={{ backgroundColor: "rgba(232,245,238,0.02)", borderWidth: 1, borderColor: "rgba(232,245,238,0.05)", borderRadius: 8, padding: 10, width: "100%", maxWidth: 300, marginTop: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <Text style={{ fontSize: 9 }}>⚠️</Text>
            <Text style={{ color: T.textMuted, fontSize: 7, letterSpacing: 1.5, fontWeight: "900" }}>BETTING RULES</Text>
          </View>
          <Text style={{ color: T.textDim, fontSize: 8, lineHeight: 13 }}>
            • Min bet: {MIN_BET.toLocaleString()} · Max: {MAX_BET.toLocaleString()}{"\n"}
            • Winner takes the full pot{"\n"}
            • Leaving early costs 2x penalty
          </Text>
        </View>

        {/* Confirm Button */}
        <Pressable
          onPress={onConfirm}
          disabled={!canBet}
          style={{
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 32,
            alignItems: "center",
            backgroundColor: canBet ? T.accent : "rgba(232,245,238,0.04)",
            borderWidth: 1,
            borderColor: canBet ? "rgba(52,211,153,0.4)" : "rgba(232,245,238,0.06)",
            shadowColor: canBet ? T.accent : "transparent",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: canBet ? 0.25 : 0,
            shadowRadius: 10,
            minWidth: 200,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: canBet ? T.bg : T.textDim }}>
            {canBet ? `PLAY · BET ${currentBet.toLocaleString()}` : "NOT ENOUGH COINS"}
          </Text>
        </Pressable>
      </View>
      <Pressable onPress={onBack} style={{ position: "absolute", bottom: 12, left: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}>
        <Text style={{ color: T.accent, fontSize: 12, fontWeight: "900" }}>← BACK</Text>
      </Pressable>
    </View>
  );
}/* ================================================================
   FRIENDS LOBBY
   ================================================================ */

type RoomPlayer = {
  id: string;
  displayName: string;
  isHost: boolean;
  status: string;
};

type NetworkInfo = {
  roomId: string;
  playerId: string;
  displayName: string;
  seatIndex: number;
  playerCount: number;
  gameId: string;
  gameState: GameState;
  socket: Socket;
};

function FriendsLobby({
  onMatchStart,
  onBack,
}: {
  onMatchStart: (network: NetworkInfo) => void;
  onBack: () => void;
}) {
  const { width } = useWindowDimensions();
  const [view, setView] = useState<"choose" | "create" | "join" | "waiting">("choose");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomId, setRoomId] = useState("");
  const [code, setCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [name] = useState("Player");
  const [error, setError] = useState("");
  const socket = useRef<Socket | null>(null);
  const matchStartingRef = useRef(false);
  const [playerId] = useState(
    () => `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  );

  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const serverUrl =
    process.env.EXPO_PUBLIC_SERVER_URL ??
    (typeof window !== "undefined" && typeof window.location?.hostname === "string"
      ? `http://${window.location.hostname}:3001`
      : `http://${hostUri?.split(":")[0] ?? "localhost"}:3001`);

  useEffect(
    () => () => {
      if (!matchStartingRef.current) socket.current?.disconnect();
    },
    [],
  );

  const connect = (callback: (connection: Socket) => void) => {
    setError("");
    if (socket.current?.connected) {
      callback(socket.current);
      return;
    }
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

    connection.on("connect", () => { clearTimeout(connectTimeout); callback(connection); });
    connection.on("connect_error", () => { clearTimeout(connectTimeout); setError("Connection failed. Check your network and try again."); });
    connection.on("room_updated", ({ room }) => { setRoomId(room.id); setRoomCode(room.inviteCode); setMaxPlayers(room.settings.maxPlayers); setPlayers(room.players); setView("waiting"); });
    connection.on("join_success", ({ room }) => { setRoomId(room.id); setRoomCode(room.inviteCode); setMaxPlayers(room.settings.maxPlayers); setPlayers(room.players); setView("waiting"); });
    connection.on("match_started", ({ roomId, playerCount, gameId, gameState, seatIndexByPlayerId }) => {
      matchStartingRef.current = true;
      onMatchStart({
        roomId,
        playerId,
        displayName: name,
        seatIndex: seatIndexByPlayerId?.[playerId] ?? 0,
        playerCount: playerCount ?? 4,
        gameId,
        gameState,
        socket: connection,
      });
    });
    connection.on("error", ({ code, message }) => setError(code === "ROOM_FULL" ? "This room is full." : code === "MATCH_IN_PROGRESS" ? "A match is already running in this room." : code === "INVALID_CODE" ? "Room code not found." : code === "NOT_HOST" ? "Only the host can start the match." : code === "NOT_ENOUGH_PLAYERS" ? "Need at least 2 players to start." : code === "GAME_NOT_RUNNING" ? "No match is running here." : code === "NOT_IN_ROOM" ? "You are not in this room." : code === "INVALID_MOVE" ? (message || "That move is not allowed.") : "Unable to join this room."));
  };

  const createRoom = () => {
    setError("");
    connect((connection) => connection.emit("join_room", { roomId: `room_${playerId}`, playerId, displayName: name, settings: { maxPlayers } }));
  };

  const joinRoom = () => {
    setError("");
    connect((connection) => {
      connection.once("found_room", ({ roomId }) => connection.emit("join_room", { roomId, playerId, displayName: name }));
      connection.emit("join_by_code", { code: code.trim().toUpperCase(), playerId });
    });
  };

  const goldBtn = (onPress: () => void, label: string, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ alignSelf: "flex-start", backgroundColor: T.gold, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, opacity: disabled ? 0.45 : 1 }}
    >
      <Text style={{ color: T.bg, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>{label}</Text>
    </Pressable>
  );

  const shell = (title: string, onBackFn: () => void, children: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ color: T.text, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>GET AWAY THULLA</Text>
        <Text style={{ color: T.accent, fontSize: 8, letterSpacing: 2, fontWeight: "900" }}>MULTIPLAYER</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
        <View style={{ width: "100%", maxWidth: 500 }}>
          <Text style={{ color: T.text, fontSize: 16, fontWeight: "900", marginBottom: 4 }}>{title}</Text>
          {children}
        </View>
      </View>
      <Pressable onPress={onBackFn} style={{ position: "absolute", bottom: 12, left: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.08)", borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}>
        <Text style={{ color: T.accent, fontSize: 12, fontWeight: "900" }}>← BACK</Text>
      </Pressable>
    </View>
  );

  if (view === "choose")
    return shell("PLAY WITH FRIENDS", onBack, (
      <>
        <Text style={{ color: T.textMuted, fontSize: 8, letterSpacing: 2, fontWeight: "900" }}>
          CREATE A TABLE OR JOIN ONE ALREADY IN PLAY.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <AnimatedPressable onPress={() => setView("create")} style={{ flex: 1, minHeight: 100, borderWidth: 1, borderColor: "rgba(232,245,238,0.1)", borderRadius: 10, backgroundColor: T.card, padding: 14, justifyContent: "center" }}>
            <Text style={{ color: T.gold, fontSize: 24 }}>＋</Text>
            <Text style={{ color: T.text, fontSize: 12, fontWeight: "900", marginTop: 6 }}>CREATE YOUR OWN ROOM</Text>
            <Text style={{ color: T.textMuted, fontSize: 8, lineHeight: 13, marginTop: 4, maxWidth: 200 }}>
              Choose the table size and invite friends with a room code.
            </Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setView("join")} style={{ flex: 1, minHeight: 100, borderWidth: 1, borderColor: "rgba(232,245,238,0.1)", borderRadius: 10, backgroundColor: T.card, padding: 14, justifyContent: "center" }}>
            <Text style={{ color: T.gold, fontSize: 24 }}>↗</Text>
            <Text style={{ color: T.text, fontSize: 12, fontWeight: "900", marginTop: 6 }}>JOIN A ROOM</Text>
            <Text style={{ color: T.textMuted, fontSize: 8, lineHeight: 13, marginTop: 4, maxWidth: 200 }}>
              Enter a room number shared by the host on your network.
            </Text>
          </AnimatedPressable>
        </View>
      </>
    ));

  if (view === "create")
    return shell("CREATE ROOM", () => setView("choose"), (
      <>
        <Text style={{ color: T.textMuted, fontSize: 8, letterSpacing: 2, fontWeight: "900" }}>
          HOW MANY PLAYERS AT THIS TABLE?
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
          {[2, 3, 4, 5, 6].map((count) => (
            <AnimatedPressable
              key={count}
              onPress={() => setMaxPlayers(count)}
              style={{ width: 52, height: 56, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: count === maxPlayers ? T.accent : T.surface, borderColor: count === maxPlayers ? T.accent : "rgba(232,245,238,0.2)" }}
            >
              <Text style={{ color: count === maxPlayers ? T.bg : T.text, fontSize: 16, fontWeight: "900" }}>{count}</Text>
              <Text style={{ color: count === maxPlayers ? T.bg : T.textMuted, fontSize: 5, fontWeight: "900", marginTop: 1 }}>PLAYERS</Text>
            </AnimatedPressable>
          ))}
        </View>
        {goldBtn(createRoom, "CREATE ROOM →")}
        {error ? <Text style={{ color: T.coral, fontSize: 9, marginTop: 8 }}>{error}</Text> : null}
      </>
    ));

  if (view === "join")
    return shell("JOIN ROOM", () => setView("choose"), (
      <>
        <Text style={{ color: T.textMuted, fontSize: 8, letterSpacing: 2, fontWeight: "900" }}>
          ENTER THE ROOM NUMBER FROM YOUR FRIEND.
        </Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="AB12CD"
          placeholderTextColor="#3A6B50"
          autoCapitalize="characters"
          maxLength={6}
          style={{ width: 200, height: 44, borderWidth: 1, borderColor: T.accent, borderRadius: 8, backgroundColor: T.surface, color: T.text, fontSize: 20, letterSpacing: 5, textAlign: "center", paddingHorizontal: 10, marginTop: 14, fontWeight: "900", alignSelf: "center" }}
        />
        {goldBtn(joinRoom, "JOIN ROOM →", code.length < 6)}
        {error ? <Text style={{ color: T.coral, fontSize: 9, marginTop: 8 }}>{error}</Text> : null}
      </>
    ));

  const isHost = players.find((p) => p.id === playerId)?.isHost ?? false;

  return shell("ROOM LOBBY", onBack, (
    <>
      <View style={{ backgroundColor: T.accent, borderRadius: 10, borderWidth: 1, borderColor: T.accent, padding: 12, marginTop: 12, alignSelf: "stretch" }}>
        <Text style={{ color: T.textMuted, fontSize: 7, letterSpacing: 2, fontWeight: "900" }}>ROOM NUMBER</Text>
        <Text style={{ color: T.bg, fontSize: 20, letterSpacing: 3, fontWeight: "900", marginTop: 2 }}>{roomCode || "------"}</Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 8, marginTop: 2 }}>
          Share this code with players on your local network
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <Text style={{ color: T.textMuted, fontSize: 8, letterSpacing: 2, fontWeight: "900" }}>PLAYERS JOINED</Text>
        <Text style={{ color: T.gold, fontSize: 12, fontWeight: "900" }}>{players.length} / {maxPlayers}</Text>
      </View>
      <View style={{ marginTop: 6, gap: 4 }}>
        {players.map((player) => (
          <View key={player.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "rgba(232,245,238,0.06)" }}>
            <View style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: T.bg, fontWeight: "900", fontSize: 9 }}>{player.displayName[0]?.toUpperCase()}</Text>
            </View>
            <Text style={{ color: T.text, fontSize: 10, fontWeight: "800", marginLeft: 8 }}>
              {player.displayName}{player.isHost ? " · HOST" : ""}
            </Text>
            <Text style={{ color: T.accent, fontSize: 8, fontWeight: "900", marginLeft: "auto" }}>
              {player.status === "active" ? "READY" : "JOINED"}
            </Text>
          </View>
        ))}
        {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (
          <View key={`empty-${i}`} style={{ paddingVertical: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(232,245,238,0.1)", borderRadius: 6, alignItems: "center" }}>
            <Text style={{ color: T.textDim, fontSize: 8, fontWeight: "900" }}>WAITING FOR PLAYER {players.length + i + 1}</Text>
          </View>
        ))}
      </View>
      {goldBtn(() => socket.current?.emit("start_match", { roomId }), !isHost ? "WAITING FOR HOST TO START" : players.length < 2 ? "WAITING FOR PLAYERS" : "START MATCH →", !isHost || players.length < 2 || !roomId)}
      {error ? <Text style={{ color: T.coral, fontSize: 9, marginTop: 8 }}>{error}</Text> : null}
    </>
  ));
}

/* ================================================================
   GAME VIEW – Full Table Layout
   ================================================================ */

function GameView({
  cardWidth,
  playerCount,
  currentBet,
  coinBalance,
  network,
  onLeave,
  onWin,
  onStatsUpdate,
}: {
  cardWidth: number;
  playerCount: number;
  currentBet: number;
  coinBalance: number;
  network: NetworkInfo | null;
  onLeave: () => void;
  onWin: (amount: number) => void;
  onStatsUpdate: (stats: FeedbackStats) => void;
}) {
  const { width, height } = useWindowDimensions();
  const humanId = network ? `player-${network.seatIndex}` : "player-0";
  const [gameState, setGameState] = useState<GameState>(() => network?.gameState ?? createGame(playerCount));
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "thulla" | "safe" | "loser" | "info" } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageRef = useRef<string>("");
  const lastSafeRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, []);

  // Networked games are server-authoritative: mirror whatever state the server broadcasts.
  useEffect(() => {
    if (network?.gameState) setGameState(network.gameState);
  }, [network?.gameState]);

  // Fresh round (solo restart or networked game_restarted) → clear round-scoped UI state.
  useEffect(() => {
    if (!network) return;
    lastMessageRef.current = "";
    lastSafeRef.current = false;
    setBanner(null);
  }, [network?.gameId]);

  const { playCardPlay, playTrickWon, playSafe, playLoser, playTurnChange, playGameOver, playButtonPress } = useSound();

  const humanPlayer = getHumanPlayer(gameState, humanId);
  const humanHand = humanPlayer?.hand ?? [];
  const playableIds = getHumanPlayableIds(gameState, humanId);
  const ledSuit = getLedSuit(gameState);
  const isHumanTurn = gameState.currentPlayerId === humanId && gameState.phase === "playing";
  const isFinished = gameState.phase === "finished";
  const activePlayerCount = gameState.activePlayerIds.length;

  const gameMenuItems: MenuItem[] = [
    { label: "Settings", icon: "⚙️", onPress: () => {} },
    { label: "How to Play", icon: "📖", onPress: () => {} },
    { label: "Leave Table", icon: "🚪", onPress: () => setShowLeaveConfirm(true), destructive: true },
  ];

  const showBanner = useCallback(
    (text: string, type: "thulla" | "safe" | "loser" | "info") => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setBanner({ text, type });
      bannerTimerRef.current = setTimeout(() => setBanner(null), 2200);
    },
    [],
  );

  useEffect(() => {
    if (gameState.phase === "finished" && gameState.loserId) {
      const loser = gameState.players.find((p) => p.id === gameState.loserId);
      const humanIsLoser = gameState.loserId === humanId;
      setTimeout(() => {
        showBanner(`${loser?.name ?? "Player"} is the LOSER!`, "loser");
        playLoser();
        if (!humanIsLoser) onWin(currentBet);
      }, 600);
      playGameOver();
      incrementStats({ gamesPlayed: 1, gamesWon: humanIsLoser ? 0 : 1, loserCount: humanIsLoser ? 1 : 0 }).then((updated) => onStatsUpdate(updated));
    }
    const hp = gameState.players.find((p) => p.id === humanId);
    if (hp?.safe && !lastSafeRef.current) {
      lastSafeRef.current = true;
      showBanner("You are SAFE!", "safe");
      playSafe();
      incrementStats({ safeCount: 1 }).then((updated) => onStatsUpdate(updated));
    }
  }, [gameState.phase]);

  useEffect(() => {
    if (gameState.message.includes("Thulla") && lastMessageRef.current !== gameState.message) {
      lastMessageRef.current = gameState.message;
      showBanner("THULLA!", "thulla");
      playTrickWon();
      incrementStats({ thullaCount: 1 }).then((updated) => onStatsUpdate(updated));
    }
  }, [gameState.message]);

  const lastPlayerIdRef = useRef<string>(gameState.currentPlayerId);

  useEffect(() => {
    const prevId = lastPlayerIdRef.current;
    lastPlayerIdRef.current = gameState.currentPlayerId;
    if (gameState.phase === "playing" && gameState.currentPlayerId === humanId && prevId !== humanId && gameState.trick.length > 0) {
      playTurnChange();
    }
  }, [gameState.currentPlayerId, gameState.phase, gameState.trick.length, playTurnChange]);

  useEffect(() => {
    if (network) return;
    if (cpuTimerRef.current) { clearTimeout(cpuTimerRef.current); cpuTimerRef.current = null; }
    if (autoPlayTimerRef.current) { clearTimeout(autoPlayTimerRef.current); autoPlayTimerRef.current = null; }

    if (gameState.phase === "playing") {
      if (gameState.currentPlayerId !== humanId) {
        // CPU turn — auto-play after 800ms
        cpuTimerRef.current = setTimeout(() => {
          setGameState((prev) => {
            if (prev.phase !== "playing" || prev.currentPlayerId === humanId) return prev;
            return playCpuTurn(prev);
          });
        }, 800);
      } else {
        // Human turn — auto-play a random valid card after 10 seconds
        autoPlayTimerRef.current = setTimeout(() => {
          setGameState((prev) => {
            if (prev.phase !== "playing" || prev.currentPlayerId !== humanId) return prev;
            const hp = prev.players.find((p) => p.id === humanId);
            if (!hp) return prev;
            const options = playableCards(hp, prev.trick);
            if (!options.length) return prev;
            const card = options[Math.floor(Math.random() * options.length)];
            return enginePlay(prev, humanId, card.id).state;
          });
        }, 10000);
      }
    }

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [gameState.currentPlayerId, gameState.phase, gameState.trick.length, humanId, network]);

  const handlePlayCard = useCallback(
    (cardId: string) => {
      if (!isHumanTurn) return;
      if (!playableIds.has(cardId)) return;
      playCardPlay();
      if (network) {
        network.socket.emit("play_card", { roomId: network.roomId, cardId });
        return;
      }
      setGameState((prev) => {
        const result = enginePlay(prev, humanId, cardId);
        return result.error ? prev : result.state;
      });
    },
    [isHumanTurn, playableIds, playCardPlay, network, humanId],
  );

  const startNewGame = useCallback(() => {
    playButtonPress();
    if (network) {
      network.socket.emit("restart_match", { roomId: network.roomId });
      return;
    }
    setGameState(createGame(playerCount));
    setBanner(null);
    lastMessageRef.current = "";
    lastSafeRef.current = false;
  }, [playerCount, playButtonPress, network]);

  const getPlayerPositions = () => {
    const positions: Array<{ id: string; name: string; x: number; y: number; isHuman: boolean; cardCount: number; safe: boolean }> = [];
    const cx = width / 2;
    const cy = height / 2 - 10;
    const rx = width * 0.35;
    const ry = height * 0.28;

    gameState.players.forEach((player, index) => {
      const isHuman = player.id === humanId;
      let x: number;
      let y: number;
      if (isHuman) {
        x = cx;
        y = height - 10;
      } else {
        const otherPlayers = gameState.players.filter((p) => p.id !== humanId);
        const otherIndex = otherPlayers.indexOf(player);
        const totalOthers = otherPlayers.length;
        const startAngle = -Math.PI * 0.8;
        const endAngle = -Math.PI * 0.2;
        const angle = totalOthers === 1 ? -Math.PI / 2 : startAngle + (endAngle - startAngle) * (otherIndex / (totalOthers - 1));
        x = cx + Math.cos(angle) * rx;
        y = cy + Math.sin(angle) * ry;
      }
      positions.push({ id: player.id, name: player.name, x, y, isHuman, cardCount: player.hand.length, safe: player.safe });
    });
    return positions;
  };

  const playerPositions = getPlayerPositions();
  const cpuPositions = playerPositions.filter((p) => !p.isHuman);
  const humanPosition = playerPositions.find((p) => p.isHuman);
  const smallCardWidth = cardWidth * 0.85;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Top Status Bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 5, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Pressable onPress={() => setShowLeaveConfirm(true)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "rgba(232,96,90,0.12)", borderWidth: 1, borderColor: "rgba(232,96,90,0.25)" }}>
          <Text style={{ color: T.coral, fontSize: 11, fontWeight: "900" }}>✕ LEAVE</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(52,211,153,0.08)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(52,211,153,0.15)" }}>
            <Text style={{ color: T.accent, fontSize: 6, fontWeight: "900" }}>BET</Text>
            <Text style={{ color: T.accent, fontSize: 11, fontWeight: "900" }}>{currentBet.toLocaleString()}</Text>
          </View>
          <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: "900" }} numberOfLines={1} ellipsizeMode="tail">
            {gameState.message}
          </Text>
          <View style={{ alignItems: "center", backgroundColor: "rgba(212,168,67,0.08)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(212,168,67,0.15)" }}>
            <Text style={{ color: T.gold, fontSize: 11, fontWeight: "900" }}>{gameState.discardCount}</Text>
            <Text style={{ color: T.textDim, fontSize: 6, letterSpacing: 1, fontWeight: "800" }}>DISC</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {gameState.players.filter(p => p.id !== humanId).map(p => (
            <View key={p.id} style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: gameState.currentPlayerId === p.id ? T.accent : "rgba(232,245,238,0.08)", borderWidth: 1, borderColor: gameState.currentPlayerId === p.id ? T.accent : "rgba(232,245,238,0.1)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 8, fontWeight: "900", color: gameState.currentPlayerId === p.id ? T.bg : T.textDim }}>{p.hand.length}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Felt Table */}
      <View style={{ flex: 1, position: "relative" }}>
        {/* Green felt background with wood frame */}
        <View style={{ position: "absolute", inset: 0, backgroundColor: "#2A1A0E", borderRadius: 0 }} />
        <View style={{ position: "absolute", top: 3, left: 3, right: 3, bottom: 3, backgroundColor: T.felt, borderRadius: 4, overflow: "hidden" }}>
          {/* Felt texture lines */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: "rgba(52,211,153,0.06)", margin: 12 }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: "rgba(52,211,153,0.03)", margin: 24 }} />

          {/* CPU Players - distributed across top */}
          {cpuPositions.map((pos) => (
            <PlayerBadge key={pos.id} name={pos.name} cardCount={pos.cardCount} isActive={gameState.currentPlayerId === pos.id} safe={pos.safe} x={pos.x - 28} y={Math.max(8, pos.y - 10)} small />
          ))}

          {/* Center trick cards */}
          {gameState.trick.map((play) => {
            const playerPos = playerPositions.find((p) => p.id === play.playerId);
            if (!playerPos) return null;
            const isHuman = play.playerId === humanId;
            const cardX = width / 2 - smallCardWidth / 2 + (gameState.trick.indexOf(play) - gameState.trick.length / 2) * (smallCardWidth + 4);
            const cardY = isHuman ? height * 0.30 : height * 0.22;
            return (
              <Animated.View key={`${play.playerId}-${play.card.id}`} entering={FadeIn.duration(300)} layout={Layout.springify()} style={{ position: "absolute", left: cardX, top: cardY }}>
                <MiniCard card={play.card} width={smallCardWidth} playerName={gameState.players.find((p) => p.id === play.playerId)?.name ?? "?"} />
              </Animated.View>
            );
          })}

          {/* Empty trick zone */}
          {gameState.trick.length === 0 && (
            <View style={{ position: "absolute", alignItems: "center", justifyContent: "center", left: 0, right: 0, top: height * 0.28, bottom: 0 }}>
              <View style={{ width: 36, height: 2, backgroundColor: "rgba(52,211,153,0.15)", borderRadius: 999 }} />
              <Text style={{ color: "rgba(52,211,153,0.25)", fontSize: 7, marginTop: 3, fontWeight: "900", letterSpacing: 3 }}>PLAY A CARD</Text>
              <View style={{ width: 36, height: 2, backgroundColor: "rgba(52,211,153,0.15)", borderRadius: 999, marginTop: 3 }} />
            </View>
          )}

          {/* Lead suit badge */}
          {ledSuit && gameState.trick.length > 0 && (
            <View style={{ position: "absolute", alignItems: "center", left: width / 2 - 14, top: height * 0.18 }}>
              <View style={{ backgroundColor: "rgba(6,15,10,0.8)", borderRadius: 999, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(52,211,153,0.25)" }}>
                <Text style={{ fontSize: 13, fontWeight: "900", color: SUIT_RED[ledSuit] ? T.coral : T.text }}>{SUIT_SYMBOL[ledSuit]}</Text>
              </View>
              <Text style={{ color: "rgba(52,211,153,0.5)", fontSize: 5, fontWeight: "900", marginTop: 1, letterSpacing: 2 }}>LEAD</Text>
            </View>
          )}

          {/* Side info pills */}
          <View style={{ position: "absolute", left: 8, top: "50%", transform: [{ translateY: -16 }] }}>
            <View style={{ backgroundColor: "rgba(6,15,10,0.7)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(52,211,153,0.12)", alignItems: "center" }}>
              <Text style={{ color: T.accent, fontSize: 11, fontWeight: "900" }}>{activePlayerCount}</Text>
              <Text style={{ color: "rgba(52,211,153,0.35)", fontSize: 5, fontWeight: "900", letterSpacing: 1 }}>PLAYERS</Text>
            </View>
          </View>
          <View style={{ position: "absolute", right: 8, top: "50%", transform: [{ translateY: -16 }] }}>
            <View style={{ backgroundColor: "rgba(6,15,10,0.7)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(212,168,67,0.12)", alignItems: "center" }}>
              <Text style={{ color: T.gold, fontSize: 11, fontWeight: "900" }}>{gameState.discardCount}</Text>
              <Text style={{ color: "rgba(212,168,67,0.35)", fontSize: 5, fontWeight: "900", letterSpacing: 1 }}>DISC</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Player Hand Tray */}
      <View style={{ backgroundColor: "#0A1A10", borderTopWidth: 2, borderTopColor: "#2A1A0E", paddingBottom: Platform.OS === "ios" ? 4 : 6 }}>
        {/* Player info bar */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: "rgba(232,245,238,0.04)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: T.bg, fontSize: 6, fontWeight: "900" }}>YOU</Text>
            </View>
            <Text style={{ color: T.text, fontSize: 8, fontWeight: "900" }}>{humanPlayer?.name ?? "YOU"}</Text>
            <Text style={{ color: T.textDim, fontSize: 7, fontWeight: "800" }}>
              {humanHand.length} cards{humanPlayer?.safe ? " · SAFE ✓" : ""}
            </Text>
          </View>
          {isHumanTurn && gameState.phase === "playing" ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ backgroundColor: "rgba(52,211,153,0.2)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: "rgba(52,211,153,0.35)" }}>
              <Text style={{ color: T.accent, fontSize: 7, fontWeight: "900", letterSpacing: 1 }}>YOUR TURN</Text>
            </Animated.View>
          ) : gameState.phase === "playing" ? (
            <Text style={{ color: T.textDim, fontSize: 7, fontWeight: "900" }}>WAITING...</Text>
          ) : null}
        </View>

        {gameState.phase === "playing" ? (
          <ScrollView
            horizontal
            contentContainerStyle={{ paddingHorizontal: Math.max(8, (width - humanHand.length * (cardWidth + 2)) / 2), paddingVertical: 3, alignItems: "flex-end", gap: 2 }}
            showsHorizontalScrollIndicator={false}
          >
            {humanHand.map((card) => {
              const isPlayable = playableIds.has(card.id);
              const dimmed = !isPlayable && isHumanTurn;
              return (
                <Pressable key={cardKey(card)} onPress={() => isPlayable && handlePlayCard(card.id)} disabled={!isPlayable}>
                  <GameCardView card={card} width={cardWidth} playable={isPlayable} dimmed={dimmed} />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ color: T.gold, fontSize: fs(width, 12), fontWeight: "900" }}>
              {gameState.loserId ? (gameState.loserId === humanId ? "YOU ARE THE LOSER!" : `${gameState.players.find((p) => p.id === gameState.loserId)?.name} IS THE LOSER!`) : "ROUND OVER"}
            </Text>
            {gameState.loserId && gameState.loserId !== humanId && (
              <View style={{ backgroundColor: "rgba(52,211,153,0.1)", borderWidth: 1, borderColor: "rgba(52,211,153,0.2)", borderRadius: 5, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 }}>
                <Text style={{ color: T.accent, fontSize: 9, fontWeight: "900" }}>+{currentBet.toLocaleString()} COINS WON!</Text>
              </View>
            )}
            <AnimatedPressable
              onPress={startNewGame}
              disabled={network ? network.seatIndex !== 0 : false}
              style={{ backgroundColor: network && network.seatIndex !== 0 ? "rgba(212,168,67,0.3)" : T.gold, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 6, marginTop: 6 }}
            >
              <Text style={{ color: T.bg, fontSize: 8, fontWeight: "900", letterSpacing: 1 }}>
                {network && network.seatIndex !== 0 ? "WAITING FOR HOST" : "PLAY AGAIN →"}
              </Text>
            </AnimatedPressable>
          </View>
        )}
      </View>

      {/* Status Banner */}
      {banner && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 50 }}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 2,
              backgroundColor: banner.type === "thulla" ? "rgba(232,96,90,0.9)" : banner.type === "safe" ? "rgba(52,211,153,0.9)" : banner.type === "loser" ? "rgba(180,40,40,0.9)" : "rgba(6,15,10,0.9)",
              borderColor: banner.type === "thulla" ? T.coral : banner.type === "safe" ? T.accent : banner.type === "loser" ? T.coral : "rgba(52,211,153,0.5)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 15,
            }}
          >
            <Text style={{ fontSize: fs(width, 16), fontWeight: "900", letterSpacing: 2, textAlign: "center", color: T.text }}>
              {banner.type === "thulla" && "⚠ "}
              {banner.text}
              {banner.type === "thulla" && " ⚠"}
            </Text>
          </View>
        </Animated.View>
      )}

      <ConfirmDialog
        visible={showLeaveConfirm}
        title="LEAVE TABLE?"
        message={`You will lose ${(currentBet * 2).toLocaleString()} coins as a penalty for leaving early. Your current bet of ${currentBet.toLocaleString()} coins will also be forfeited.`}
        confirmLabel={`LEAVE · PAY ${(currentBet * 2).toLocaleString()}`}
        cancelLabel="STAY"
        destructive
        onConfirm={() => { setShowLeaveConfirm(false); onLeave(); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </View>
  );
}

/* ================================================================
   PLAYER BADGE
   ================================================================ */

function PlayerBadge({ name, cardCount, isActive, safe, x, y, small = false }: { name: string; cardCount: number; isActive: boolean; safe: boolean; x: number; y: number; small?: boolean }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isActive]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View style={[pulseStyle, { position: "absolute", left: x, top: y }]} pointerEvents="none">
      <View style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, backgroundColor: isActive ? "rgba(52,211,153,0.9)" : safe ? "rgba(52,211,153,0.5)" : "rgba(6,15,10,0.7)", borderColor: isActive ? T.gold : safe ? "rgba(52,211,153,0.4)" : "rgba(232,245,238,0.15)" }}>
          <View style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: isActive ? T.gold : "rgba(52,211,153,0.8)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "900", fontSize: 7, color: isActive ? T.bg : T.text }}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={{ fontWeight: "900", fontSize: 7, color: isActive ? T.bg : T.text }} numberOfLines={1}>{name.length > 6 ? name.slice(0, 6) : name}</Text>
          <View style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: isActive ? "rgba(212,168,67,0.3)" : "rgba(232,245,238,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "900", fontSize: 6, color: isActive ? T.bg : T.textMuted }}>{cardCount}</Text>
          </View>
          {safe && <Text style={{ color: T.accent, fontSize: 6, fontWeight: "900" }}>✓</Text>}
        </View>
        {cardCount > 0 && (
          <View style={{ flexDirection: "row", marginTop: 1, gap: 1 }}>
            {Array.from({ length: Math.min(cardCount, 4) }).map((_, i) => (
              <View key={i} style={{ width: 6, height: 8, borderRadius: 1, backgroundColor: T.felt, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)" }} />
            ))}
            {cardCount > 4 && <Text style={{ color: T.textDim, fontSize: 5, marginLeft: 1 }}>+{cardCount - 4}</Text>}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/* ================================================================
   MINI CARD
   ================================================================ */

function MiniCard({ card, width, playerName }: { card: GameCard; width: number; playerName: string }) {
  const isRed = SUIT_RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];
  const suitColor = isRed ? T.coral : T.text;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width, height: width * 1.3, backgroundColor: T.surface, borderWidth: 1, borderColor: "rgba(232,245,238,0.1)", borderRadius: 6, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", backgroundColor: "rgba(232,245,238,0.025)" }} />
        <Text style={{ position: "absolute", top: 2, left: 3, fontSize: width * 0.15, color: suitColor, fontWeight: "900" }}>{card.rank}{symbol}</Text>
        <Text style={{ position: "absolute", alignSelf: "center", fontSize: width * 0.4, color: suitColor, opacity: 0.08, top: "30%", fontWeight: "900" }}>{symbol}</Text>
        <Text style={{ position: "absolute", alignSelf: "center", fontSize: width * 0.28, color: suitColor, top: "32%" }}>{symbol}</Text>
        <Text style={{ position: "absolute", bottom: 2, right: 3, fontSize: width * 0.15, color: suitColor, fontWeight: "900", transform: [{ rotate: "180deg" }] }}>{card.rank}{symbol}</Text>
      </View>
      <Text style={{ color: "rgba(52,211,153,0.4)", fontSize: 5, fontWeight: "900", marginTop: 1 }} numberOfLines={1}>{playerName}</Text>
    </View>
  );
}

/* ================================================================
   GAME CARD VIEW
   ================================================================ */

function GameCardView({ card, width, playable = false, dimmed = false }: { card: GameCard; width: number; playable?: boolean; dimmed?: boolean }) {
  const isRed = SUIT_RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];
  const suitColor = isRed ? T.coral : T.text;

  return (
    <View
      style={{
        width,
        height: width * 1.4,
        backgroundColor: T.surface,
        borderWidth: playable ? 1.5 : 1,
        borderColor: playable ? T.gold : dimmed ? "rgba(232,245,238,0.06)" : "rgba(232,245,238,0.08)",
        borderRadius: 8,
        marginHorizontal: 1,
        justifyContent: "space-between",
        opacity: dimmed ? 0.4 : 1,
        shadowColor: playable ? T.gold : "#000",
        shadowOffset: { width: 0, height: playable ? 2 : 1 },
        shadowOpacity: playable ? 0.4 : 0.25,
        shadowRadius: playable ? 8 : 3,
        elevation: playable ? 8 : 2,
        overflow: "hidden",
      }}
    >
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", backgroundColor: "rgba(232,245,238,0.03)", borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, borderWidth: 1, borderColor: "rgba(232,245,238,0.04)" }} />
      <View style={{ position: "absolute", top: 4, left: 4, alignItems: "center" }}>
        <Text style={{ fontSize: width * 0.18, color: suitColor, fontWeight: "900" }}>{card.rank}</Text>
        <Text style={{ fontSize: width * 0.14, color: suitColor, marginTop: 1 }}>{symbol}</Text>
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: width * 0.45, color: suitColor, opacity: 0.1, fontWeight: "900" }}>{symbol}</Text>
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: width * 0.34, color: suitColor }}>{symbol}</Text>
      </View>
      <View style={{ position: "absolute", bottom: 4, right: 4, alignItems: "center", transform: [{ rotate: "180deg" }] }}>
        <Text style={{ fontSize: width * 0.18, color: suitColor, fontWeight: "900" }}>{card.rank}</Text>
        <Text style={{ fontSize: width * 0.14, color: suitColor, marginTop: 1 }}>{symbol}</Text>
      </View>
      {playable && (
        <View style={{ position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(212,168,67,0.35)", pointerEvents: "none", shadowColor: T.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 }} />
      )}
      {dimmed && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, backgroundColor: "rgba(15,20,25,0.55)", pointerEvents: "none" }} />
      )}
    </View>
  );
}

/* ================================================================
   GAME SCREEN (Main Export)
   ================================================================ */

export default function GameScreen() {
  const { width, height } = useWindowDimensions();
  const [stage, setStage] = useState<Stage>("splash");
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [showFeedback, setShowFeedback] = useState(false);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
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

  useEffect(() => {
    loadStats().then(setStats);
    claimWelcomeBonus().then(setCoinBalance);
    getTransactionHistory().then(setTransactions);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setStage("onboarding"), 1700);
    return () => clearTimeout(timer);
  }, []);

  // Networked match: sync authoritative game state + restart broadcasts.
  useEffect(() => {
    if (!network) return;
    const socket = network.socket;
    const onGameUpdate = ({ gameState }: { gameState: GameState }) =>
      setNetwork((prev) => (prev ? { ...prev, gameState } : prev));
    const onGameRestarted = ({ gameId, gameState }: { gameId: string; gameState: GameState }) =>
      setNetwork((prev) => (prev ? { ...prev, gameId, gameState } : prev));
    socket.on("game_update", onGameUpdate);
    socket.on("game_restarted", onGameRestarted);
    return () => {
      socket.off("game_update", onGameUpdate);
      socket.off("game_restarted", onGameRestarted);
    };
  }, [network]);

  const cardWidth = Math.max(36, Math.min(48, Math.min(width, height) * 0.11));

  if (stage === "splash") return <SplashView />;
  if (stage === "onboarding")
    return <OnboardingView page={onboardingPage} setPage={setOnboardingPage} onFinish={() => setStage("menu")} />;
  if (stage === "settings")
    return <SettingsPage onBack={() => setStage("menu")} />;
  if (stage === "stats")
    return <StatsPage stats={stats} transactions={transactions} coinBalance={coinBalance} onBack={() => setStage("menu")} />;
  if (stage === "howtoplay")
    return <HowToPlayPage onBack={() => setStage("menu")} />;
  if (stage === "betting")
    return <BettingPage coinBalance={coinBalance} currentBet={currentBet} setCurrentBet={setCurrentBet} onConfirm={() => setStage("game")} onBack={() => setStage("menu")} />;
  if (stage === "menu")
    return (
      <View style={{ flex: 1 }}>
        <MenuView
          coinBalance={coinBalance}
          onPlay={(playerCount) => { playButtonPress(); setSelectedPlayerCount(playerCount); setStage("betting"); }}
          onFriends={() => { playButtonPress(); setStage("lobby"); }}
          onSettings={() => setStage("settings")}
          onStats={() => setStage("stats")}
          onHowToPlay={() => setStage("howtoplay")}
        />
        <FeedbackSummary
          visible={showFeedback}
          stats={stats}
          onClose={() => setShowFeedback(false)}
          onPlayWithFriends={() => { setShowFeedback(false); setStage("lobby"); }}
        />
      </View>
    );
  if (stage === "lobby")
    return <FriendsLobby onMatchStart={(info) => { setNetwork(info); setSelectedPlayerCount(info.playerCount); setStage("game"); }} onBack={() => setStage("menu")} />;

  return (
    <GameView
      cardWidth={cardWidth}
      playerCount={selectedPlayerCount}
      currentBet={currentBet}
      coinBalance={coinBalance}
      network={network}
      onLeave={async () => {
        network?.socket?.disconnect();
        setNetwork(null);
        const newBal = await applyLeavePenalty(currentBet);
        setCoinBalance(newBal);
        setStage("menu");
      }}
      onWin={async (amount) => { const newBal = await awardWinnings(amount); setCoinBalance(newBal); }}
      onStatsUpdate={setStats}
    />
  );
}
