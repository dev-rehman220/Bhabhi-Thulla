const { io } = require("socket.io-client");

const SERVER = "http://localhost:3001";

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { transports: ["websocket"], timeout: 5000 });
    socket._name = name;
    let resolved = false;
    const done = (fn, arg) => {
      if (!resolved) {
        resolved = true;
        fn(arg);
      }
    };
    socket.on("connect", () => {
      log(`${name} connected (id=${socket.id.slice(0, 6)})`);
      done(resolve, socket);
    });
    socket.on("connect_error", (err) =>
      done(() => {
        log(`${name} CONNECTION ERROR: ${err.message}`);
        reject(err);
      }),
    );
  });
}

function pickCard(player, trick) {
  if (!trick.length) {
    const ace = player.hand.find((c) => c.id === "A-spades");
    return (ace || player.hand[0]).id;
  }
  const led = trick[0].card.suit;
  const follows = player.hand.filter((c) => c.suit === led);
  const pool = follows.length ? follows : player.hand;
  return pool[0].id;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  log("=== Starting networked gameplay test ===");

  const host = await connect("HOST");
  host._playerId = "gpl_host";
  host.emit("join_room", {
    roomId: "room_gameplay",
    playerId: host._playerId,
    displayName: "HostPlayer",
    settings: { maxPlayers: 2 },
  });
  await wait(400);

  const guest = await connect("GUEST");
  guest._playerId = "gpl_guest";
  guest.emit("join_room", {
    roomId: "room_gameplay",
    playerId: guest._playerId,
    displayName: "GuestPlayer",
  });
  await wait(400);

  // Shared observed state
  const state = { current: null, gameId: null, sawFinish: false, updates: 0, mismatch: false };
  const seatOf = { host: null, guest: null };
  const plays = { count: 0 };

  const reactToState = (sock, gameState) => {
    if (state.sawFinish || plays.count >= 4) return;
    const mine = sock === host ? "host" : "guest";
    const seatId = `player-${seatOf[mine]}`;
    if (!gameState || gameState.phase !== "playing") return;
    if (gameState.currentPlayerId !== seatId) return;
    const me = gameState.players.find((p) => p.id === seatId);
    if (!me || me.isCpu) return;
    plays.count += 1;
    const cardId = pickCard(me, gameState.trick);
    log(`${sock._name} plays ${cardId} (move ${plays.count})`);
    sock.emit("play_card", { roomId: "room_gameplay", cardId });
  };

  const wire = (sock) => {
    sock.on("match_started", (d) => {
      state.gameId = d.gameId;
      seatOf[sock === host ? "host" : "guest"] = d.seatIndexByPlayerId[sock._playerId];
      log(`${sock._name} match_started seat=${d.seatIndexByPlayerId[sock._playerId]} gameId=${d.gameId.slice(0, 8)}`);
      state.current = d.gameState;
      setTimeout(() => reactToState(sock, d.gameState), 400);
    });

    sock.on("game_update", (d) => {
      if (state.gameId && d.gameId !== state.gameId) {
        state.mismatch = true;
        log(`${sock._name} MISMATCHED gameId: ${d.gameId}`);
      }
      state.updates += 1;
      state.current = d.gameState;
      if (d.gameState.phase === "finished") {
        state.sawFinish = true;
        log(`${sock._name} saw finish: ${d.gameState.message}`);
      } else {
        log(`${sock._name} game_update (trick ${d.gameState.trick.length}/${d.gameState.activePlayerIds.length}, disc=${d.gameState.discardCount}, turn=${d.gameState.currentPlayerId})`);
      }
      setTimeout(() => reactToState(sock, d.gameState), 200);
    });

    sock.on("error", ({ code }) => {
      log(`${sock._name} ERROR: ${code}`);
      plays.count += 10; // stop acting
    });
  };
  wire(host);
  wire(guest);

  host.emit("start_match", { roomId: "room_gameplay" });
  await wait(400);

  for (let i = 0; i < 40 && plays.count < 4 && !state.sawFinish; i += 1) {
    await wait(350);
  }
  await wait(700);

  log("=== Test Complete ===");
  log(`game_update broadcasts: ${state.updates} (>=2 expected)`);
  log(`cards played: ${plays.count} (>=2 expected)`);
  log(`seats: HOST=${seatOf.host} GUEST=${seatOf.guest} (host should be 0)`);
  log(`finished reached: ${state.sawFinish}`);

  host.disconnect();
  guest.disconnect();

  const allPassed =
    state.updates >= 2 &&
    plays.count >= 2 &&
    seatOf.host === 0 &&
    seatOf.guest === 1 &&
    !state.mismatch;
  log(`\nResult: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});