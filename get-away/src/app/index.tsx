import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { ReactNode } from "react";
import Constants from "expo-constants";
import { io, Socket } from "socket.io-client";

type Card = { id: number; rank: string; suit: string; red: boolean };
const suits = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♣", red: false },
  { symbol: "♦", red: true },
];
const ranks = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const makeDeck = (): Card[] =>
  ranks.flatMap((rank, rankIndex) =>
    suits.map((suit, suitIndex) => ({
      id: rankIndex * 4 + suitIndex,
      rank,
      suit: suit.symbol,
      red: suit.red,
    })),
  );

export default function GameScreen() {
  const { width, height } = useWindowDimensions();
  const [stage, setStage] = useState<
    "splash" | "onboarding" | "menu" | "lobby" | "game"
  >("splash");
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [entrance] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 700,
      useNativeDriver: false,
    }).start();
    const timer = setTimeout(() => setStage("onboarding"), 1700);
    return () => clearTimeout(timer);
  }, [entrance]);
  const [deck, setDeck] = useState(makeDeck);
  const [hand, setHand] = useState(() => makeDeck().slice(0, 7));
  const [discard, setDiscard] = useState(() => makeDeck()[21]);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(120);
  const [message, setMessage] = useState(
    "Your move: match the top card by suit or rank.",
  );
  const cardWidth = Math.max(56, Math.min(78, Math.max(width, height) * 0.105));
  const drawCard = () => {
    const next = deck.find(
      (card) =>
        !hand.some((held) => held.id === card.id) && card.id !== discard.id,
    );
    if (next) {
      setHand((current) => [...current, next]);
      setDeck((current) => current.filter((card) => card.id !== next.id));
      setMessage("New card drawn. Play it or pass.");
    }
  };
  const playCard = (card: Card) => {
    if (card.suit === discard.suit || card.rank === discard.rank) {
      setHand((current) => current.filter((held) => held.id !== card.id));
      setDiscard(card);
      setScore((current) => current + (Number(card.rank) || 10));
      setMessage(`${card.rank}${card.suit} played. The table is yours.`);
      setSelected(null);
    } else setMessage("That card does not match the discard pile.");
  };
  const reset = () => {
    setHand(makeDeck().slice(0, 7));
    setDiscard(makeDeck()[21]);
    setScore(120);
    setSelected(null);
    setMessage("Your move: match the top card by suit or rank.");
  };
  if (stage === "splash") return <SplashScreen entrance={entrance} />;
  if (stage === "onboarding")
    return (
      <OnboardingScreen
        page={onboardingPage}
        setPage={setOnboardingPage}
        onFinish={() => setStage("menu")}
      />
    );
  if (stage === "menu")
    return (
      <MainMenu
        onPlay={() => setStage("game")}
        onFriends={() => setStage("lobby")}
      />
    );
  if (stage === "lobby")
    return (
      <FriendsLobby
        onStart={() => setStage("game")}
        onBack={() => setStage("menu")}
      />
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hud}>
        <Pressable onPress={reset} style={styles.menu}>
          <Text style={styles.menuText}>↻ NEW GAME</Text>
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>CLASSIC MODE · ROUND 01</Text>
          <Text style={styles.title}>GET WAY CARDS</Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>{score}</Text>
          <Text style={styles.muted}>SCORE</Text>
        </View>
      </View>
      <View style={styles.board}>
        <View style={styles.opponent}>
          <Text style={styles.muted}>OPPONENT · 7 CARDS</Text>
          <View style={styles.backRow}>
            {hand.slice(0, 5).map((card) => (
              <CardView key={card.id} card={card} width={cardWidth} back />
            ))}
          </View>
        </View>
        <View style={styles.center}>
          <View style={styles.piles}>
            <Pile label="DISCARD" card={discard} width={cardWidth} />
            <Pile label="DRAW" width={cardWidth} back />
          </View>
          <Text style={styles.turn}>YOUR TURN</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={drawCard} style={styles.primary}>
            <Text style={styles.primaryText}>DRAW CARD</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setMessage("Pass is available after drawing a card.")
            }
            style={styles.gameSecondary}
          >
            <Text style={styles.gameSecondaryText}>PASS TURN</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.handSection}>
        <View style={styles.handHeader}>
          <Text style={styles.muted}>YOUR HAND · {hand.length}</Text>
          <Text style={styles.hint}>TAP A MATCH TO PLAY</Text>
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={styles.hand}
          showsHorizontalScrollIndicator={false}
        >
          {hand.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => {
                setSelected(card.id);
                playCard(card);
              }}
            >
              <CardView
                card={card}
                width={cardWidth}
                selected={selected === card.id}
              />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
function SplashScreen({ entrance }: { entrance: Animated.Value }) {
  return (
    <View style={styles.splash}>
      <Animated.View
        style={{
          opacity: entrance,
          transform: [
            {
              scale: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1],
              }),
            },
          ],
        }}
      >
        <View style={styles.splashBadge}>
          <Text style={styles.splashStar}>✦</Text>
        </View>
        <Text style={styles.splashTitle}>GET WAY</Text>
        <Text style={styles.splashAccent}>CARDS</Text>
        <Text style={styles.splashTagline}>
          READ THE TABLE. FIND YOUR WAY OUT.
        </Text>
      </Animated.View>
      <View style={styles.loading}>
        <View style={styles.loadingTrack}>
          <Animated.View
            style={[
              styles.loadingFill,
              {
                width: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["8%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.loadingText}>SHUFFLING THE DECK</Text>
      </View>
    </View>
  );
}
function OnboardingScreen({
  page,
  setPage,
  onFinish,
}: {
  page: number;
  setPage: (page: number) => void;
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
    <SafeAreaView style={styles.onboarding}>
      <View style={styles.onboardingTop}>
        <Text style={styles.onboardingBrand}>
          GET WAY <Text style={styles.onboardingBrandAccent}>CARDS</Text>
        </Text>
        <Pressable onPress={onFinish}>
          <Text style={styles.skip}>SKIP</Text>
        </Pressable>
      </View>
      <View style={styles.onboardingBody}>
        <View style={styles.featureCard}>
          <Text style={styles.featureSymbol}>{slide.symbol}</Text>
          <View style={styles.featureLine} />
          <Text style={styles.featureIndex}>0{page + 1}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.slideKicker}>{slide.kicker}</Text>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideBody}>{slide.body}</Text>
          <View style={styles.dots}>
            {slides.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => setPage(index)}
                style={[styles.dot, index === page && styles.dotActive]}
              />
            ))}
          </View>
          <Pressable
            onPress={() =>
              page === slides.length - 1 ? onFinish() : setPage(page + 1)
            }
            style={styles.continue}
          >
            <Text style={styles.continueText}>
              {page === slides.length - 1 ? "PLAY NOW  →" : "CONTINUE  →"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
function MainMenu({
  onPlay,
  onFriends,
}: {
  onPlay: () => void;
  onFriends: () => void;
}) {
  const [notice, setNotice] = useState("SELECT A MODE TO BEGIN");
  return (
    <SafeAreaView style={styles.menuScreen}>
      <View style={styles.menuHeader}>
        <View>
          <Text style={styles.menuKicker}>WELCOME BACK, PLAYER</Text>
          <Text style={styles.menuTitle}>
            GET WAY <Text style={styles.menuTitleAccent}>CARDS</Text>
          </Text>
        </View>
        <View style={styles.profile}>
          <Text style={styles.profileLevel}>LVL 01</Text>
          <Text style={styles.muted}>TABLE READY</Text>
        </View>
      </View>
      <View style={styles.menuContent}>
        <View style={styles.menuIntro}>
          <Text style={styles.menuIntroKicker}>CHOOSE YOUR TABLE</Text>
          <Text style={styles.menuIntroTitle}>HOW DO YOU WANT TO PLAY?</Text>
          <Text style={styles.menuIntroBody}>{notice}</Text>
        </View>
        <View style={styles.modeGrid}>
          <Pressable onPress={onPlay} style={[styles.modeCard, styles.cpuCard]}>
            <View style={styles.modeIcon}>
              <Text style={styles.modeIconText}>♠</Text>
            </View>
            <View>
              <Text style={styles.modeKicker}>SOLO MATCH</Text>
              <Text style={styles.modeTitle}>PLAY VS CPU</Text>
              <Text style={styles.modeBody}>
                Sharpen your reads against an adaptive opponent.
              </Text>
            </View>
            <Text style={styles.modeArrow}>→</Text>
          </Pressable>
          <Pressable
            onPress={onFriends}
            style={[styles.modeCard, styles.friendsCard]}
          >
            <View style={styles.modeIcon}>
              <Text style={styles.modeIconText}>♣</Text>
            </View>
            <View>
              <Text style={styles.modeKicker}>LOCAL TABLE</Text>
              <Text style={styles.modeTitle}>PLAY WITH FRIENDS</Text>
              <Text style={styles.modeBody}>
                Create a room and deal in with your crew.
              </Text>
            </View>
            <Text style={styles.modeArrow}>→</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setNotice(
                "SETTINGS: SOUND, HAPTICS AND MOTION ARE READY TO TUNE.",
              )
            }
            style={styles.utilityCard}
          >
            <Text style={styles.utilityIcon}>⚙</Text>
            <View>
              <Text style={styles.modeKicker}>PREFERENCES</Text>
              <Text style={styles.utilityTitle}>SETTINGS</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() =>
              setNotice("YOUR STATS WILL APPEAR HERE AFTER YOUR FIRST MATCH.")
            }
            style={styles.utilityCard}
          >
            <Text style={styles.utilityIcon}>◆</Text>
            <View>
              <Text style={styles.modeKicker}>YOUR RECORD</Text>
              <Text style={styles.utilityTitle}>STATISTICS</Text>
            </View>
          </Pressable>
        </View>
      </View>
      <Text style={styles.menuFooter}>
        GET WAY CARDS · CLASSIC EDITION · BUILD 01
      </Text>
    </SafeAreaView>
  );
}

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
    const connection = io(serverUrl, {
      transports: ["websocket"],
      reconnection: true,
    });
    socket.current = connection;
    connection.on("connect", () => callback(connection));
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
        <Text style={styles.lobbyLead}>
          CREATE A TABLE OR JOIN ONE ALREADY IN PLAY.
        </Text>
        <View style={styles.choiceRow}>
          <Pressable
            onPress={() => setView("create")}
            style={styles.choiceCard}
          >
            <Text style={styles.choiceIcon}>＋</Text>
            <Text style={styles.choiceTitle}>CREATE YOUR OWN ROOM</Text>
            <Text style={styles.choiceBody}>
              Choose the table size and invite friends with a room code.
            </Text>
          </Pressable>
          <Pressable onPress={() => setView("join")} style={styles.choiceCard}>
            <Text style={styles.choiceIcon}>↗</Text>
            <Text style={styles.choiceTitle}>JOIN A ROOM</Text>
            <Text style={styles.choiceBody}>
              Enter a room number shared by the host on your network.
            </Text>
          </Pressable>
        </View>
      </LobbyShell>
    );
  if (view === "create")
    return (
      <LobbyShell title="CREATE ROOM" onBack={() => setView("choose")}>
        <Text style={styles.lobbyLead}>HOW MANY PLAYERS AT THIS TABLE?</Text>
        <View style={styles.playerChoices}>
          {[2, 3, 4, 5, 6].map((count) => (
            <Pressable
              key={count}
              onPress={() => setMaxPlayers(count)}
              style={[
                styles.playerChoice,
                count === maxPlayers && styles.playerChoiceActive,
              ]}
            >
              <Text style={styles.playerChoiceNumber}>{count}</Text>
              <Text style={styles.playerChoiceLabel}>PLAYERS</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={createRoom} style={styles.lobbyPrimary}>
          <Text style={styles.lobbyPrimaryText}>CREATE ROOM →</Text>
        </Pressable>
      </LobbyShell>
    );
  if (view === "join")
    return (
      <LobbyShell title="JOIN ROOM" onBack={() => setView("choose")}>
        <Text style={styles.lobbyLead}>
          ENTER THE ROOM NUMBER FROM YOUR FRIEND.
        </Text>
        <TextInput
          value={code}
          onChangeText={(value) =>
            setCode(
              value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6),
            )
          }
          placeholder="AB12CD"
          placeholderTextColor="#55737a"
          autoCapitalize="characters"
          maxLength={6}
          style={styles.codeInput}
        />
        <Pressable
          onPress={joinRoom}
          disabled={code.length < 6}
          style={[styles.lobbyPrimary, code.length < 6 && styles.disabled]}
        >
          <Text style={styles.lobbyPrimaryText}>JOIN ROOM →</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </LobbyShell>
    );
  return (
    <LobbyShell title="ROOM LOBBY" onBack={onBack}>
      <View style={styles.roomCode}>
        <Text style={styles.muted}>ROOM NUMBER</Text>
        <Text style={styles.roomCodeText}>{roomCode || "------"}</Text>
        <Text style={styles.roomHint}>
          Share this code with players on your local network
        </Text>
      </View>
      <View style={styles.rosterHeader}>
        <Text style={styles.lobbyLead}>PLAYERS JOINED</Text>
        <Text style={styles.slots}>
          {players.length} / {maxPlayers}
        </Text>
      </View>
      <View style={styles.roster}>
        {players.map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {player.displayName[0]?.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.playerName}>
              {player.displayName}
              {player.isHost ? "  · HOST" : ""}
            </Text>
            <Text style={styles.ready}>
              {player.status === "active" ? "READY" : "JOINED"}
            </Text>
          </View>
        ))}
        {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map(
          (_, index) => (
            <View key={`empty-${index}`} style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                WAITING FOR PLAYER {players.length + index + 1}
              </Text>
            </View>
          ),
        )}
      </View>
      <Pressable
        disabled={players.length < 2 || !roomId}
        onPress={() =>
          socket.current?.emit("start_match", { roomId })
        }
        style={[styles.lobbyPrimary, (players.length < 2 || !roomId) && styles.disabled]}
      >
        <Text style={styles.lobbyPrimaryText}>
          {players.length < 2 ? "WAITING FOR PLAYERS" : "START MATCH  →"}
        </Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    <SafeAreaView style={styles.lobbyScreen}>
      <View style={styles.lobbyNav}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <Text style={styles.lobbyBrand}>GET WAY CARDS</Text>
        <Text style={styles.lobbyStep}>MULTIPLAYER</Text>
      </View>
      <View style={styles.lobbyMain}>
        <Text style={styles.lobbyTitle}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}
function CardView({
  card,
  width,
  back = false,
  selected = false,
}: {
  card: Card;
  width: number;
  back?: boolean;
  selected?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        { width, height: width * 1.45 },
        back && styles.cardBack,
        selected && styles.cardSelected,
      ]}
    >
      {back ? (
        <>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.backLabel}>GET WAY</Text>
        </>
      ) : (
        <>
          <Text style={[styles.corner, card.red && styles.red]}>
            {card.rank}
            {card.suit}
          </Text>
          <Text style={[styles.suit, card.red && styles.red]}>{card.suit}</Text>
          <Text style={[styles.cornerBottom, card.red && styles.red]}>
            {card.rank}
          </Text>
        </>
      )}
    </View>
  );
}
function Pile({
  label,
  card,
  width,
  back = false,
}: {
  label: string;
  card?: Card;
  width: number;
  back?: boolean;
}) {
  return (
    <View style={styles.pile}>
      <Text style={styles.muted}>{label}</Text>
      {card && <CardView card={card} width={width} back={back} />}
    </View>
  );
}
const styles = StyleSheet.create({
  lobbyScreen: {
    flex: 1,
    backgroundColor: "#071b29",
    paddingHorizontal: 30,
    paddingTop: 18,
    paddingBottom: 18,
  },
  lobbyNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backText: { color: "#f5c96a", fontSize: 11, fontWeight: "900", padding: 10 },
  lobbyBrand: {
    color: "#f5f1e8",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },
  lobbyStep: {
    color: "#6fe0d0",
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  lobbyMain: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  lobbyTitle: {
    color: "#f5f1e8",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },
  lobbyLead: {
    color: "#9db3bc",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  choiceRow: { flexDirection: "row", gap: 16, marginTop: 22 },
  choiceCard: {
    flex: 1,
    minHeight: 190,
    borderWidth: 1,
    borderColor: "#55737a",
    borderRadius: 12,
    backgroundColor: "#102f3b",
    padding: 22,
    justifyContent: "center",
  },
  choiceIcon: { color: "#f5c96a", fontSize: 40, fontWeight: "300" },
  choiceTitle: {
    color: "#f5f1e8",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  choiceBody: {
    color: "#b4c5c9",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 260,
  },
  playerChoices: { flexDirection: "row", gap: 10, marginTop: 22 },
  playerChoice: {
    width: 82,
    height: 82,
    borderWidth: 1,
    borderColor: "#55737a",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#102f3b",
  },
  playerChoiceActive: { backgroundColor: "#1b6672", borderColor: "#6fe0d0" },
  playerChoiceNumber: { color: "#f5f1e8", fontSize: 25, fontWeight: "900" },
  playerChoiceLabel: {
    color: "#9db3bc",
    fontSize: 8,
    fontWeight: "900",
    marginTop: 2,
  },
  lobbyPrimary: {
    alignSelf: "flex-start",
    backgroundColor: "#f5c96a",
    borderRadius: 8,
    paddingHorizontal: 25,
    paddingVertical: 15,
    marginTop: 26,
  },
  lobbyPrimaryText: {
    color: "#102f3b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  codeInput: {
    width: 270,
    height: 62,
    borderWidth: 1,
    borderColor: "#6fe0d0",
    borderRadius: 9,
    backgroundColor: "#102f3b",
    color: "#f5f1e8",
    fontSize: 25,
    letterSpacing: 7,
    textAlign: "center",
    paddingHorizontal: 14,
    marginTop: 22,
    fontWeight: "900",
  },
  lobbySecondary: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#55737a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  errorText: { color: "#f27c68", fontSize: 11, marginTop: 12 },
  roomCode: {
    backgroundColor: "#1b6672",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6fe0d0",
    padding: 18,
    marginTop: 20,
    alignSelf: "stretch",
  },
  roomCodeText: {
    color: "#f5c96a",
    fontSize: 34,
    letterSpacing: 8,
    fontWeight: "900",
    marginTop: 5,
  },
  roomHint: { color: "#b4c5c9", fontSize: 11, marginTop: 5 },
  rosterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  slots: { color: "#f5c96a", fontSize: 16, fontWeight: "900" },
  roster: { marginTop: 10, gap: 6 },
  playerRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: "#263b49",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6fe0d0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#102f3b", fontWeight: "900" },
  playerName: {
    color: "#f5f1e8",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 10,
  },
  ready: {
    color: "#6fe0d0",
    fontSize: 9,
    fontWeight: "900",
    marginLeft: "auto",
  },
  emptyRow: {
    minHeight: 34,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#385762",
    borderRadius: 7,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  emptyText: { color: "#55737a", fontSize: 9, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  splash: {
    flex: 1,
    backgroundColor: "#071b29",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  splashBadge: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: "#1b6672",
    borderWidth: 2,
    borderColor: "#6fe0d0",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "8deg" }],
  },
  splashStar: { color: "#f5c96a", fontSize: 52 },
  splashTitle: {
    color: "#f5f1e8",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 24,
    textAlign: "center",
  },
  splashAccent: {
    color: "#f5c96a",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign: "center",
  },
  splashTagline: {
    color: "#9db3bc",
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 14,
    textAlign: "center",
  },
  loading: {
    position: "absolute",
    bottom: 32,
    width: "70%",
    maxWidth: 320,
    alignItems: "center",
  },
  loadingTrack: {
    width: "100%",
    height: 3,
    backgroundColor: "#24424d",
    borderRadius: 3,
  },
  loadingFill: { height: 3, backgroundColor: "#f5c96a", borderRadius: 3 },
  loadingText: {
    color: "#6fe0d0",
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 10,
    fontWeight: "800",
  },
  onboarding: {
    flex: 1,
    backgroundColor: "#102f3b",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  onboardingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  onboardingBrand: {
    color: "#f5f1e8",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },
  onboardingBrandAccent: { color: "#f5c96a" },
  skip: {
    color: "#9db3bc",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    padding: 10,
  },
  onboardingBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 56,
  },
  featureCard: {
    width: 150,
    height: 210,
    backgroundColor: "#1b6672",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#6fe0d0",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  featureSymbol: { color: "#f5c96a", fontSize: 90, fontWeight: "900" },
  featureLine: {
    width: 68,
    height: 2,
    backgroundColor: "#6fe0d0",
    marginTop: 12,
  },
  featureIndex: {
    color: "#f5f1e8",
    fontSize: 12,
    fontWeight: "900",
    position: "absolute",
    bottom: 16,
    right: 18,
  },
  copy: { width: "45%", maxWidth: 430 },
  slideKicker: {
    color: "#6fe0d0",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
  },
  slideTitle: {
    color: "#f5f1e8",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 10,
  },
  slideBody: {
    color: "#b4c5c9",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 380,
  },
  dots: { flexDirection: "row", gap: 7, marginTop: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#55737a" },
  dotActive: { width: 27, backgroundColor: "#f5c96a" },
  continue: {
    alignSelf: "flex-start",
    backgroundColor: "#f5c96a",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 15,
    marginTop: 28,
  },
  continueText: {
    color: "#102f3b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  menuScreen: {
    flex: 1,
    backgroundColor: "#071b29",
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 14,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuKicker: {
    color: "#6fe0d0",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
  },
  menuTitle: {
    color: "#f5f1e8",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 3,
  },
  menuTitleAccent: { color: "#f5c96a" },
  profile: {
    alignItems: "flex-end",
    borderLeftWidth: 1,
    borderLeftColor: "#55737a",
    paddingLeft: 18,
  },
  profileLevel: { color: "#f5c96a", fontSize: 14, fontWeight: "900" },
  menuContent: { flex: 1, justifyContent: "center" },
  menuIntro: { marginBottom: 18 },
  menuIntroKicker: {
    color: "#9db3bc",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
  },
  menuIntroTitle: {
    color: "#f5f1e8",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },
  menuIntroBody: {
    color: "#6fe0d0",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "800",
    marginTop: 7,
  },
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modeCard: {
    minHeight: 142,
    flexGrow: 1,
    flexBasis: "42%",
    borderRadius: 12,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderWidth: 1,
  },
  cpuCard: { backgroundColor: "#1b6672", borderColor: "#6fe0d0" },
  friendsCard: { backgroundColor: "#263b49", borderColor: "#55737a" },
  modeIcon: {
    width: 52,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#f5f1e8",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconText: { color: "#102f3b", fontSize: 38 },
  modeKicker: {
    color: "#9db3bc",
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  modeTitle: {
    color: "#f5f1e8",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  modeBody: { color: "#b4c5c9", fontSize: 11, marginTop: 6, maxWidth: 190 },
  modeArrow: { color: "#f5c96a", fontSize: 25, marginLeft: "auto" },
  utilityCard: {
    minHeight: 72,
    flexGrow: 1,
    flexBasis: "42%",
    borderRadius: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#385762",
    backgroundColor: "#102f3b",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  utilityIcon: { color: "#f5c96a", fontSize: 23 },
  utilityTitle: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
  menuFooter: {
    color: "#55737a",
    textAlign: "center",
    fontSize: 8,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  safe: {
    flex: 1,
    backgroundColor: "#102f3b",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  hud: {
    minHeight: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menu: {
    borderWidth: 1,
    borderColor: "#55737a",
    padding: 10,
    borderRadius: 8,
  },
  menuText: { color: "#f5c96a", fontWeight: "800", fontSize: 11 },
  eyebrow: {
    color: "#6fe0d0",
    fontSize: 9,
    letterSpacing: 1.5,
    textAlign: "center",
    fontWeight: "800",
  },
  title: {
    color: "#f5f1e8",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  score: { alignItems: "flex-end", minWidth: 70 },
  scoreValue: { color: "#f5c96a", fontSize: 24, fontWeight: "900" },
  muted: { color: "#9db3bc", fontSize: 9, letterSpacing: 1, fontWeight: "800" },
  board: { flex: 1, flexDirection: "row", alignItems: "center" },
  opponent: { width: "27%", alignItems: "center" },
  backRow: { flexDirection: "row", marginTop: 8 },
  center: { flex: 1, alignItems: "center" },
  piles: { flexDirection: "row", gap: 18 },
  pile: { alignItems: "center", gap: 8 },
  turn: {
    color: "#f5c96a",
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: "900",
    marginTop: 12,
  },
  message: {
    color: "#f5f1e8",
    fontSize: 11,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 6,
  },
  actions: { width: 130, gap: 8 },
  primary: { backgroundColor: "#f5c96a", paddingVertical: 14, borderRadius: 8 },
  primaryText: {
    color: "#102f3b",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 11,
  },
  gameSecondary: {
    borderWidth: 1,
    borderColor: "#55737a",
    paddingVertical: 13,
    borderRadius: 8,
  },
  gameSecondaryText: { color: "#f5c96a", fontSize: 10, fontWeight: "900" },
  handSection: { borderTopWidth: 1, borderTopColor: "#55737a", paddingTop: 8 },
  handHeader: { flexDirection: "row", justifyContent: "space-between" },
  hint: { color: "#f5c96a", fontSize: 9, fontWeight: "900" },
  hand: { paddingVertical: 12, alignItems: "flex-end" },
  card: {
    backgroundColor: "#f5f1e8",
    borderRadius: 10,
    marginHorizontal: 4,
    padding: 8,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  cardBack: {
    backgroundColor: "#1b6672",
    borderWidth: 2,
    borderColor: "#6fe0d0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: "#f5c96a",
    transform: [{ translateY: -14 }],
  },
  corner: { color: "#102f3b", fontWeight: "900", fontSize: 14 },
  cornerBottom: {
    color: "#102f3b",
    fontWeight: "900",
    fontSize: 14,
    alignSelf: "flex-end",
    transform: [{ rotate: "180deg" }],
  },
  suit: { color: "#102f3b", fontSize: 30, alignSelf: "center" },
  red: { color: "#d75f55" },
  star: { color: "#f5c96a", fontSize: 25 },
  backLabel: {
    color: "#f5f1e8",
    fontSize: 7,
    letterSpacing: 1,
    fontWeight: "900",
  },
});
