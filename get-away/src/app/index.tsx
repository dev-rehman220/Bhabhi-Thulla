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
import { loadStats } from "@/utils/gameStats";
import {
  createGame,
  playCard as enginePlay,
  playCpuTurn,
} from "@/game/bhabhiGame";
import type { BhabhiState, GameCard, BhabhiPlayer, Suit } from "@/game/bhabhiGame";

/* ================================================================
   TYPES & CONSTANTS
   ================================================================ */

type Stage = "splash" | "onboarding" | "menu" | "lobby" | "game";

/* ── Bhabhi helpers ───────────────────────────────────────── */

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

function getHumanPlayer(state: BhabhiState): BhabhiPlayer | undefined {
  return state.players.find((p) => p.id === "player-0");
}

function getLedSuit(state: BhabhiState): Suit | null {
  if (!state.trick.length) return null;
  return state.trick[0].card.suit;
}

function getHumanPlayableIds(state: BhabhiState): Set<string> {
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
  }, []);

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
  const [stats, setStats] = useState<FeedbackStats>({
    gamesPlayed: 0,
    gamesWon: 0,
    bhabhiCount: 0,
    thullaCount: 0,
    safeCount: 0,
    longestStreak: 0,
    favoriteCard: "—",
  });
  const { playButtonPress } = useSound();

  // Load persisted stats on mount
  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setStage("onboarding"), 1700);
    return () => clearTimeout(timer);
  }, []);

  const cardWidth = Math.max(52, Math.min(74, Math.max(width, height) * 0.095));

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
  if (stage === "menu")
    return (
      <>
        <MenuView
          onPlay={(playerCount) => {
            playButtonPress();
            setSelectedPlayerCount(playerCount);
            setStage("game");
          }}
          onFriends={() => {
            playButtonPress();
            setShowFeedback(true);
          }}
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
    <BhabhiGameView
      cardWidth={cardWidth}
      playerCount={selectedPlayerCount}
      onLeave={() => {
        setStage("menu");
      }}
    />
  );
}

/* ================================================================
   SPLASH SCREEN
   ================================================================ */

function SplashView() {
  const progress = useSharedValue(0);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.82, 1]) }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth * interpolate(progress.value, [0, 1], [0.08, 1]),
  }));

  return (
    <View className="flex-1 bg-ink items-center justify-center px-6">
      <Animated.View style={contentStyle} className="items-center">
        <View
          className="w-24 h-24 rounded-[22px] bg-teal border-2 border-aqua items-center justify-center"
          style={{ transform: [{ rotate: "8deg" }] }}
        >
          <Text className="text-gold text-5xl">✦</Text>
        </View>
        <Text className="text-cloud text-[42px] font-black tracking-wider mt-6 text-center">
          GET WAY
        </Text>
        <Text className="text-gold text-[42px] font-black tracking-wider text-center">
          CARDS
        </Text>
        <Text className="text-muted text-[10px] tracking-widest mt-3.5 text-center">
          READ THE TABLE. FIND YOUR WAY OUT.
        </Text>
      </Animated.View>
      <View className="absolute bottom-8 w-[70%] max-w-[320px] items-center">
        <View
          className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden"
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={barStyle}
            className="h-full bg-gold rounded-full"
          />
        </View>
        <Text className="text-aqua text-[9px] tracking-widest mt-2.5 font-extrabold">
          SHUFFLING THE DECK
        </Text>
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
  const slides = [
    {
      kicker: "01 · READ THE TABLE",
      title: "MATCH YOUR WAY OUT",
      body: "Play a card that shares the suit or rank of the discard pile.",
      symbol: "♠",
    },
    {
      kicker: "02 · OWN YOUR TURN",
      title: "CHOOSE WITH PURPOSE",
      body: "Draw when you need a new option. Every card in your hand changes the table.",
      symbol: "♦",
    },
    {
      kicker: "03 · GET AWAY",
      title: "EMPTY YOUR HAND",
      body: "Be the first to play every card and turn smart moves into a high score.",
      symbol: "★",
    },
  ];
  const slide = slides[page];

  return (
    <SafeAreaView className="flex-1 bg-navy px-6 pt-3 pb-5">
      <View className="flex-row justify-between items-center">
        <Text className="text-cloud text-[15px] font-black tracking-wider">
          GET WAY <Text className="text-gold">CARDS</Text>
        </Text>
        <Pressable onPress={onFinish} className="p-2.5">
          <Text className="text-muted text-[11px] font-extrabold tracking-wider">
            SKIP
          </Text>
        </Pressable>
      </View>
      <View className="flex-1 flex-row items-center justify-center gap-6 flex-wrap">
        <View
          className="bg-teal rounded-[18px] border-2 border-aqua items-center justify-center"
          style={{
            width: 150,
            height: 210,
            transform: [{ rotate: "-8deg" }],
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Text className="text-gold text-[90px] font-black">
            {slide.symbol}
          </Text>
          <View className="w-[68px] h-[2px] bg-aqua mt-3" />
          <Text className="text-cloud text-xs font-black absolute bottom-4 right-4">
            0{page + 1}
          </Text>
        </View>
        <View className="max-w-[200px]">
          <Text className="text-aqua text-[10px] tracking-widest font-black">
            {slide.kicker}
          </Text>
          <Text className="text-cloud text-[26px] font-black mt-2.5">
            {slide.title}
          </Text>
          <Text className="text-white/60 text-[14px] leading-6 mt-3">
            {slide.body}
          </Text>
          <View className="flex-row gap-1.5 mt-7">
            {slides.map((_, i) => (
              <Pressable key={i} onPress={() => setPage(i)}>
                <View
                  className={`h-2 rounded-full ${
                    i === page ? "w-7 bg-gold" : "w-2 bg-white/20"
                  }`}
                />
              </Pressable>
            ))}
          </View>
          <AnimatedPressable
            onPress={() =>
              page === slides.length - 1 ? onFinish() : setPage(page + 1)
            }
            className="self-start bg-gold rounded-lg px-6 py-3.5 mt-7"
          >
            <Text className="text-ink text-[11px] font-black tracking-wider">
              {page === slides.length - 1 ? "PLAY NOW  →" : "CONTINUE  →"}
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ================================================================
   MAIN MENU
   ================================================================ */

function MenuView({
  onPlay,
  onFriends,
}: {
  onPlay: (playerCount: number) => void;
  onFriends: () => void;
}) {
  const [notice, setNotice] = useState("SELECT A MODE TO BEGIN");
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);

  const menuItems: MenuItem[] = [
    {
      label: "Settings",
      icon: "⚙️",
      onPress: () =>
        setNotice("SETTINGS: SOUND, HAPTICS AND MOTION ARE READY TO TUNE."),
    },
    {
      label: "Statistics",
      icon: "📊",
      onPress: () =>
        setNotice("YOUR STATS WILL APPEAR HERE AFTER YOUR FIRST MATCH."),
    },
    {
      label: "How to Play",
      icon: "📖",
      onPress: () =>
        setNotice(
          "BHABHI THULLA: Follow the lead suit! If you can't, you hit a Thulla and the trick winner picks up all cards. Empty your hand to be SAFE. The last player standing is the BHABHI!",
        ),
    },
    {
      label: "Exit App",
      icon: "🚪",
      onPress: () => {
        if (Platform.OS === "android") {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("react-native").BackHandler?.exitApp();
        }
      },
      destructive: true,
    },
  ];

  return (
    <View className="flex-1 bg-ink">
      <View className="absolute inset-0" pointerEvents="none">
        <View className="absolute bottom-0 left-0 right-0 h-[60%] bg-navy/30" />
        <View className="absolute bottom-0 left-0 right-0 h-[40%] bg-felt/20" />
        <View className="absolute bottom-0 left-0 right-0 h-[20%] bg-teal/10" />
      </View>
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <FloatingDecorCard symbol="♠" x="8%" y="15%" rotation={15} delay={0} />
        <FloatingDecorCard symbol="♥" x="78%" y="10%" rotation={-12} delay={400} />
        <FloatingDecorCard symbol="♣" x="5%" y="72%" rotation={8} delay={800} />
        <FloatingDecorCard symbol="♦" x="82%" y="68%" rotation={-20} delay={200} />
      </View>
      <SafeAreaView className="flex-1 px-7 pt-4 pb-3.5">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-aqua text-[10px] tracking-widest font-black">
              WELCOME BACK, PLAYER
            </Text>
            <Text className="text-cloud text-2xl font-black tracking-wider mt-0.5">
              GET WAY <Text className="text-gold">CARDS</Text>
            </Text>
          </View>
          <HamburgerMenu items={menuItems} />
        </View>
        <View className="flex-1 justify-center">
          <View className="mb-5">
            <Text className="text-muted text-[10px] tracking-widest font-black">
              CHOOSE YOUR TABLE
            </Text>
            <Text className="text-cloud text-[22px] font-black mt-1">
              HOW DO YOU WANT TO PLAY?
            </Text>
            <Text className="text-aqua text-[10px] tracking-wider font-extrabold mt-2">
              {notice}
            </Text>
          </View>
          <View className="flex-row gap-3 mb-3">
            <AnimatedPressable
              onPress={() => setShowPlayerSelect(true)}
              className="flex-1 min-h-[142px] rounded-2xl p-5 border border-aqua/30 bg-teal/80"
              style={{
                shadowColor: "#6FE0D0",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View className="w-[52px] h-[70px] rounded-lg bg-white/20 items-center justify-center mb-3">
                <Text className="text-gold text-[38px]">♠</Text>
              </View>
              <Text className="text-muted text-[9px] tracking-widest font-black">
                SOLO MATCH
              </Text>
              <Text className="text-cloud text-[17px] font-black mt-1">
                PLAY VS CPU
              </Text>
              <Text className="text-white/60 text-[11px] mt-1.5 max-w-[190px]">
                Challenge the table with adaptive AI opponents.
              </Text>
              <Text className="text-gold text-2xl absolute right-5 top-0 bottom-0 justify-center">
                →
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={onFriends}
              className="flex-1 min-h-[142px] rounded-2xl p-5 border border-white/20 bg-white/[0.06]"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View className="w-[52px] h-[70px] rounded-lg bg-white/20 items-center justify-center mb-3">
                <Text className="text-gold text-[38px]">♣</Text>
              </View>
              <Text className="text-muted text-[9px] tracking-widest font-black">
                LOCAL TABLE
              </Text>
              <Text className="text-cloud text-[17px] font-black mt-1">
                PLAY WITH FRIENDS
              </Text>
              <Text className="text-white/60 text-[11px] mt-1.5 max-w-[190px]">
                Create a room and deal in with your crew.
              </Text>
              <Text className="text-gold text-2xl absolute right-5 top-0 bottom-0 justify-center">
                →
              </Text>
            </AnimatedPressable>
          </View>
          <View className="flex-row gap-3">
            <AnimatedPressable
              onPress={() =>
                setNotice("SETTINGS: SOUND, HAPTICS AND MOTION ARE READY TO TUNE.")
              }
              className="flex-1 min-h-[72px] rounded-xl px-5 border border-white/10 bg-white/[0.04] flex-row items-center gap-3"
            >
              <Text className="text-gold text-xl">⚙</Text>
              <View>
                <Text className="text-muted text-[9px] tracking-widest font-black">
                  PREFERENCES
                </Text>
                <Text className="text-cloud text-sm font-black mt-0.5">
                  SETTINGS
                </Text>
              </View>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() =>
                setNotice("YOUR STATS WILL APPEAR HERE AFTER YOUR FIRST MATCH.")
              }
              className="flex-1 min-h-[72px] rounded-xl px-5 border border-white/10 bg-white/[0.04] flex-row items-center gap-3"
            >
              <Text className="text-gold text-xl">◆</Text>
              <View>
                <Text className="text-muted text-[9px] tracking-widest font-black">
                  YOUR RECORD
                </Text>
                <Text className="text-cloud text-sm font-black mt-0.5">
                  STATISTICS
                </Text>
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* Player Select Modal */}
        {showPlayerSelect && (
          <View className="absolute inset-0 bg-black/70 items-center justify-center z-50">
            <View className="bg-ink border border-aqua/30 rounded-2xl p-6 w-[340px]">
              <Text className="text-cloud text-lg font-black text-center">
                SELECT TABLE SIZE
              </Text>
              <Text className="text-muted text-[10px] tracking-widest text-center mt-1">
                CHOOSE HOW MANY PLAYERS
              </Text>
              <View className="flex-row gap-2.5 mt-5 justify-center">
                {[3, 4, 5, 6].map((count) => (
                  <AnimatedPressable
                    key={count}
                    onPress={() => {
                      setShowPlayerSelect(false);
                      onPlay(count);
                    }}
                    className="w-[68px] h-[68px] border border-aqua/30 rounded-xl bg-teal/60 items-center justify-center"
                  >
                    <Text className="text-cloud text-xl font-black">{count}</Text>
                    <Text className="text-muted text-[7px] font-black">PLAYERS</Text>
                  </AnimatedPressable>
                ))}
              </View>
              <AnimatedPressable
                onPress={() => setShowPlayerSelect(false)}
                className="mt-4 py-2"
              >
                <Text className="text-muted text-[10px] font-black text-center tracking-wider">
                  CANCEL
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        <Text className="text-white/20 text-[8px] tracking-widest font-extrabold text-center">
          BHABHI THULLA · CLASSIC EDITION · BUILD 01
        </Text>
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
   BHABHI THULLA GAME VIEW – Full Table Layout
   ================================================================ */

function BhabhiGameView({
  cardWidth,
  playerCount,
  onLeave,
}: {
  cardWidth: number;
  playerCount: number;
  onLeave: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [gameState, setGameState] = useState<BhabhiState>(() =>
    createGame(playerCount),
  );
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "thulla" | "safe" | "bhabhi" | "info" } | null>(null);
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
    playBhabhi,
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
    (text: string, type: "thulla" | "safe" | "bhabhi" | "info") => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setBanner({ text, type });
      bannerTimerRef.current = setTimeout(() => setBanner(null), 2200);
    },
    [],
  );

  /* ── Check for safe/bhabhi after state changes ───────── */
  useEffect(() => {
    if (gameState.phase === "finished" && gameState.loserId) {
      const loser = gameState.players.find((p) => p.id === gameState.loserId);
      setTimeout(() => {
        showBanner(`${loser?.name ?? "Player"} is the BHABHI!`, "bhabhi");
        playBhabhi();
      }, 600);
      playGameOver();
    }
    const humanPlayer = gameState.players.find((p) => p.id === "player-0");
    if (humanPlayer?.safe && !lastSafeRef.current) {
      lastSafeRef.current = true;
      showBanner("You are SAFE!", "safe");
      playSafe();
    }
  }, [gameState.phase]);

  /* ── Thulla detection from message ───────────────────── */
  useEffect(() => {
    if (gameState.message.includes("Thulla") && lastMessageRef.current !== gameState.message) {
      lastMessageRef.current = gameState.message;
      showBanner("THULLA!", "thulla");
      playTrickWon();
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
            className="py-1.5"
          >
            <Text className="text-coral text-[11px] font-black">← LEAVE</Text>
          </Pressable>
          <View className="items-center">
            <Text className="text-gold text-[9px] tracking-widest font-extrabold">
              BHABHI THULLA · {playerCount} PLAYERS
            </Text>
            <Text className="text-cloud text-sm font-black" numberOfLines={1} ellipsizeMode="tail">
              {gameState.message}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
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
            className="absolute inset-2 rounded-[28px]"
            style={{
              borderWidth: 6,
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
            className="absolute inset-4 rounded-[22px] overflow-hidden"
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

            {/* ── Center Trick Zone ─────────────────── */}
            <View
              className="absolute items-center justify-center"
              style={{
                left: width * 0.5 - 140,
                top: height * 0.33 - 50,
                width: 280,
                height: 100,
              }}
            >
              {/* Cross-shaped trick slots */}
              <View className="flex-row gap-1 items-center justify-center flex-wrap">
                {gameState.trick.map((play, i) => (
                  <Animated.View
                    key={`${play.playerId}-${play.card.id}`}
                    entering={FadeIn.duration(300)}
                    layout={Layout.springify()}
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
                ))}
                {gameState.trick.length === 0 && (
                  <View className="items-center">
                    <View className="w-12 h-[2px] bg-aqua/20 rounded-full" />
                    <Text className="text-aqua/30 text-[8px] mt-1 font-black tracking-wider">
                      TRICK
                    </Text>
                    <View className="w-12 h-[2px] bg-aqua/20 rounded-full mt-1" />
                  </View>
                )}
              </View>

              {/* Lead Suit Indicator */}
              {ledSuit && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  className="absolute -top-8 items-center"
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
                    LEAD SUIT
                  </Text>
                </Animated.View>
              )}
            </View>

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
                paddingHorizontal: Math.max(10, (width - humanHand.length * (cardWidth + 2)) / 2),
                paddingVertical: 4,
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
                  ? `${gameState.players.find((p) => p.id === gameState.loserId)?.name} IS THE BHABHI!`
                  : "ROUND OVER"}
              </Text>
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
                  : banner.type === "bhabhi"
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
                    : banner.type === "bhabhi"
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
        message="Are you sure you want to leave? Your current game progress will be lost."
        confirmLabel="LEAVE TABLE"
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
      className={`mx-0.5 p-2 justify-between rounded-xl ${
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
        className={`font-black text-sm z-10 ${isRed ? "text-coral" : "text-ink"}`}
      >
        {card.rank}
        {symbol}
      </Text>

      {/* Faint suit watermark in center */}
      <Text
        className={`absolute self-center font-black opacity-[0.05] z-0 ${
          isRed ? "text-coral" : "text-muted"
        }`}
        style={{ fontSize: 44, top: "32%" }}
      >
        {symbol}
      </Text>

      {/* Center suit icon */}
      <Text
        className={`text-[28px] self-center z-10 ${isRed ? "text-coral" : "text-muted"}`}
      >
        {symbol}
      </Text>

      {/* Inverted Rank + Suit bottom-right */}
      <Text
        className={`font-black text-sm self-end z-10 ${isRed ? "text-coral" : "text-ink"}`}
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
