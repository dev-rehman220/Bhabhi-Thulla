const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const engine = require("./gameEngine");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

const PORT = process.env.PORT || 3001;

// Seconds a human gets on their turn before the server auto-plays a random card.
const TURN_AUTO_MS = 10000;

// ─── Room Store ────────────────────────────────────────────────
const rooms = new Map();

// Public rooms waiting to be filled by Quick Match.
const waitingQueue = new Set();

function makeRoomId() {
  return `qm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Add a room to the queue while it still has a seat for another REAL player
// (empty seats are handed to disguised CPUs, so a room stays open for matching
// until every seat is taken by a human).
function syncQueue(room) {
  if (room && room.players.length > 0 && room.players.length < room.maxPlayers) {
    waitingQueue.add(room.id);
  } else if (room) {
    waitingQueue.delete(room.id);
  }
}

// First public table that still has a free seat matching the requested size AND bet.
function findOpenTable(size, bet) {
  for (const roomId of waitingQueue) {
    const room = rooms.get(roomId);
    if (
      room &&
      room.players.length < room.maxPlayers &&
      room.maxPlayers === size &&
      room.bet === bet
    ) {
      return room;
    }
  }
  return null;
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const VALID_AVATAR_IDS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

// Human-looking names used to fill empty seats so the player cannot tell the
// opponents are actually CPUs. Also a matching (real) name → no giveaway.
const CPU_NAMES = [
  "Arjun", "Raj", "Simran", "Aisha", "Vikram", "Priya", "Neha", "Karan",
  "Sana", "Rohit", "Deepika", "Aman", "Zoya", "Imran", "Kavita", "Ravi",
  "Sneha", "Aditya", "Meera", "Farhan", "Ananya", "Sandeep", "Tanya", "Gaurav",
];

function disguiseCpuName(seedIndex) {
  return CPU_NAMES[seedIndex % CPU_NAMES.length];
}

function sanitizeName(value) {
  const name = String(value ?? "").trim().slice(0, 16);
  return name || "Player";
}

function sanitizeAvatarId(value) {
  return VALID_AVATAR_IDS.has(value) ? value : "1";
}

function findRoomByCode(code) {
  for (const [id, room] of rooms) {
    if (room.inviteCode === code) return { id, room };
  }
  return null;
}

function roomToJSON(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    settings: { maxPlayers: room.maxPlayers, bet: room.bet },
    players: room.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      avatarId: sanitizeAvatarId(p.avatarId),
      isHost: p.isHost,
      status: p.status,
    })),
  };
}

function joinRoom(socket, room, playerId, displayName, avatarId) {
  const existing = room.players.find((p) => p.id === playerId);
  if (!existing) {
    if (room.players.length >= room.maxPlayers) return { error: "ROOM_FULL" };

    // When the room is already running (auto-started with disguised CPUs), seat
    // the newcomer in an empty slot and free that seat's CPU.
    const freeSeat = findFreeSeatIndex(room);
    if (freeSeat === null) return { error: "ROOM_FULL" };

    room.players.push({
      id: playerId,
      displayName: sanitizeName(displayName),
      avatarId: sanitizeAvatarId(avatarId),
      isHost: room.players.length === 0,
      status: "active",
      socketId: socket.id,
      seatIndex: freeSeat,
    });
  } else {
    existing.socketId = socket.id;
  }
  socket.join(room.id);
  socket.data = { roomId: room.id, playerId };
  io.to(room.id).emit("room_updated", { room: roomToJSON(room) });
  syncQueue(room);
  return { ok: true };
}

// Returns the seat index (0-based) that still has no REAL player in the room,
// or null when every seat is taken by a human.
function findFreeSeatIndex(room) {
  const taken = new Set(room.players.map((p) => p.seatIndex).filter((i) => typeof i === "number"));
  for (let i = 0; i < room.maxPlayers; i += 1) {
    if (!taken.has(i)) return i;
  }
  return null;
}

function broadcastOnlineCount() {
  io.emit("online_players", { count: io.engine.clientsCount });
}

setInterval(broadcastOnlineCount, 5000).unref();

function makeGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Builds an authoritative game for a room, preserving each player's seat across restarts.
// Any seat with no live player is handed over to a (disguised-name) CPU.
// For quick-match rooms (autoCpuFill) the table is always the full requested size so a
// solo starter is greeted by a full table of human-looking opponents. For private rooms
// the game is sized to the humans actually present.
function buildGameForRoom(room) {
  room.players.forEach((p, i) => {
    if (typeof p.seatIndex !== "number") p.seatIndex = i;
  });
  const requested = room.autoCpuFill
    ? room.maxPlayers
    : Math.max(2, ...room.players.map((p) => p.seatIndex + 1));
  let state = engine.createNetworkGame(requested);
  const playerBySeat = new Map(room.players.map((p) => [p.seatIndex, p]));
  state = {
    ...state,
    players: state.players.map((p, i) => {
      const roomPlayer = playerBySeat.get(i);
      if (roomPlayer) {
        return {
          ...p,
          name: sanitizeName(roomPlayer.displayName),
          avatarId: sanitizeAvatarId(roomPlayer.avatarId),
          isCpu: false,
        };
      }
      // Empty seat → disguise as a human-looking CPU so opponents can't tell.
      return {
        ...p,
        name: disguiseCpuName(i + p.name.length + room.players.length),
        avatarId: String((i + room.players.length) % 9 + 1),
        isCpu: true,
      };
    }),
  };
  return state;
}

function isCpuTurn(state) {
  if (!state || state.phase !== "playing" || !state.currentPlayerId) return false;
  const player = state.players.find((p) => p.id === state.currentPlayerId);
  return Boolean(player && player.isCpu);
}

function stopCpuTimer(room) {
  if (room.cpuTimer) {
    clearInterval(room.cpuTimer);
    room.cpuTimer = null;
  }
}

// Covers the timeout a human gets before the server auto-plays a random card.
function stopTurnTimers(room) {
  stopCpuTimer(room);
  if (room.autoTurnTimer) {
    clearTimeout(room.autoTurnTimer);
    room.autoTurnTimer = null;
  }
}

function startCpuTimer(room) {
  room.cpuTimer = setInterval(() => {
    const state = room.game && room.game.state;
    if (!state || state.phase !== "playing" || !isCpuTurn(state)) {
      stopCpuTimer(room);
      scheduleTurnTimers(room);
      return;
    }
    room.game.state = engine.playCpuTurn(state);
    io.to(room.id).emit("game_update", { gameId: room.game.gameId, gameState: room.game.state });
  }, 700);
}

function scheduleTurnTimers(room) {
  if (!room.game) return;
  const state = room.game.state;
  if (!state || state.phase !== "playing") {
    stopTurnTimers(room);
    return;
  }
  if (isCpuTurn(state)) {
    if (room.autoTurnTimer) {
      clearTimeout(room.autoTurnTimer);
      room.autoTurnTimer = null;
    }
    if (!room.cpuTimer) startCpuTimer(room);
    return;
  }
stopCpuTimer(room);
  if (room.autoTurnTimer) {
    clearTimeout(room.autoTurnTimer);
    room.autoTurnTimer = null;
  }
  room.autoTurnTimer = setTimeout(() => {
    room.autoTurnTimer = null;
    const st = room.game && room.game.state;
    if (!st || st.phase !== "playing" || isCpuTurn(st)) return;
    room.game.state = engine.playAutoTurn(st);
    io.to(room.id).emit("game_update", { gameId: room.game.gameId, gameState: room.game.state });
    scheduleTurnTimers(room);
  }, TURN_AUTO_MS);
}

// Builds + starts the authoritative game for a room and broadcasts it. Emits
// `match_started` to everyone in the room. Used by the instant online match
// (auto-fill with disguised CPUs) and by host-initiated private matches.
function startMatchForRoom(room) {
  room.started = true;
  waitingQueue.delete(room.id);
  const gameState = buildGameForRoom(room);
  room.game = { gameId: makeGameId(), state: gameState };
  const seatIndexByPlayerId = {};
  room.players.forEach((p) => {
    seatIndexByPlayerId[p.id] = p.seatIndex;
  });
  console.log(`[MATCH STARTED] ${room.inviteCode} (${room.players.length} human, ${room.maxPlayers - room.players.length} CPU)`);

  io.to(room.id).emit("match_started", {
    roomId: room.id,
    gameId: room.game.gameId,
    playerCount: room.maxPlayers,
    bet: room.bet,
    players: room.players.map((p) => ({ id: p.id, name: p.displayName, avatarId: sanitizeAvatarId(p.avatarId) })),
    gameState: room.game.state,
    seatIndexByPlayerId,
  });

  scheduleTurnTimers(room);
}

// When a real player joins an already-running (CPU-filled) online table, swap
// this seat's disguised CPU for the real human, preserving the live hand and
// turn so the round continues seamlessly. Emits `match_started` to the newcomer
// and `game_update` (rebuilt with real names/avatar) to everyone.
function seatHumanInLiveGame(room, playerId) {
  const roomPlayer = room.players.find((p) => p.id === playerId);
  if (!roomPlayer) return false;
  const state = room.game && room.game.state;
  if (!state) return false;
  const seat = roomPlayer.seatIndex;
  if (typeof seat !== "number" || seat >= state.players.length) return false;

  room.game.state = {
    ...state,
    players: state.players.map((p, i) => {
      if (i !== seat) return p;
      return {
        ...p,
        name: sanitizeName(roomPlayer.displayName),
        avatarId: sanitizeAvatarId(roomPlayer.avatarId),
        isCpu: false,
      };
    }),
  };

  const seatIndexByPlayerId = { [playerId]: seat };
  io.to(room.id).emit("match_started", {
    roomId: room.id,
    gameId: room.game.gameId,
    playerCount: room.maxPlayers,
    bet: room.bet,
    players: room.players.map((p) => ({ id: p.id, name: p.displayName, avatarId: sanitizeAvatarId(p.avatarId) })),
    gameState: room.game.state,
    seatIndexByPlayerId,
  });
  io.to(room.id).emit("game_update", { gameId: room.game.gameId, gameState: room.game.state });
  scheduleTurnTimers(room);
  return true;
}

// ─── Socket Events ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  broadcastOnlineCount();

  // ── Join / Create Room ──────────────────────────────────────
  socket.on("join_room", ({ roomId, playerId, displayName, avatarId, settings }) => {
    const maxPlayers = settings?.maxPlayers ?? 4;

    let room = rooms.get(roomId);

    if (room && room.started) {
      socket.emit("error", { code: "MATCH_IN_PROGRESS" });
      return;
    }

    if (!room) {
      // Create new room
      const inviteCode = generateCode();
      room = {
        id: roomId,
        inviteCode,
        maxPlayers,
        players: [],
        hostId: playerId,
        started: false,
      };
      rooms.set(roomId, room);
      console.log(`[ROOM CREATED] ${room.inviteCode} (${roomId})`);
    }

    const result = joinRoom(socket, room, playerId, displayName, avatarId);
    if (result.error) {
      socket.emit("error", { code: result.error });
      return;
    }

    console.log(`[JOINED] ${sanitizeName(displayName)} → ${room.inviteCode} (${room.players.length}/${room.maxPlayers})`);
  });

  // ── Quick Match (matchmaking queue) ─────────────────────────
  socket.on("quick_match", ({ playerId, displayName, avatarId, maxPlayers, bet }) => {
    const size = Math.max(2, Math.min(6, Number(maxPlayers) || 4));
    const tableBet = Math.max(1000, Math.min(100000, Number(bet) || 1000));

    // Only match against tables with the SAME size AND the SAME bet.
    let room = findOpenTable(size, tableBet);
    if (!room) {
      room = {
        id: makeRoomId(),
        inviteCode: generateCode(),
        maxPlayers: size,
        bet: tableBet,
        players: [],
        hostId: playerId,
        started: false,
        autoCpuFill: true,
      };
      rooms.set(room.id, room);
      console.log(`[QUICK ROOM CREATED] ${room.inviteCode} (${room.id}) size=${size} bet=${tableBet}`);
    }

    const result = joinRoom(socket, room, playerId, displayName, avatarId);
    if (result.error) {
      socket.emit("error", { code: result.error });
      return;
    }

    // If a REAL player already started a game here (running with disguised
    // CPUs), seat the newcomer in the freed slot and continue seamlessly.
    if (room.game) {
      seatHumanInLiveGame(room, playerId);
      console.log(`[QUICK JOIN] ${sanitizeName(displayName)} → ${room.inviteCode} (seat ${room.players.find((p) => p.id === playerId).seatIndex})`);
      return;
    }

    // No matching human opponent yet → auto-start immediately, silently filling
    // the other seats with disguised CPUs (real-looking names/avatars) so the
    // player can't tell they are bots. The table stays open for matching.
    startMatchForRoom(room);
    syncQueue(room);
    console.log(`[QUICK MATCH] ${sanitizeName(displayName)} → ${room.inviteCode} auto-started with CPU fill (${room.players.length}/${room.maxPlayers})`);
  });

  // ── Cancel matchmaking ──────────────────────────────────────
  socket.on("leave_matchmaking", () => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId || !playerId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    waitingQueue.delete(room.id);
    if (!room.started && room.players.length <= 1) {
      rooms.delete(room.id);
      console.log(`[MATCHMAKING CANCELLED] ${room.inviteCode} removed`);
    }
  });

  // ── Join by Invite Code ─────────────────────────────────────
  socket.on("join_by_code", ({ code, playerId }) => {
    if (!code || !playerId) {
      socket.emit("error", { code: "INVALID_CODE" });
      return;
    }

    const found = findRoomByCode(code.toUpperCase().trim());
    if (!found) {
      socket.emit("error", { code: "INVALID_CODE" });
      return;
    }

    // Tell the client the roomId so they can emit join_room
    socket.emit("found_room", { roomId: found.id });
  });

  // ── Start Match ─────────────────────────────────────────────
  socket.on("start_match", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", { code: "ROOM_NOT_FOUND" });
      return;
    }

    // Only host can start
    const sender = room.players.find((p) => p.socketId === socket.id);
    if (!sender || !sender.isHost) {
      socket.emit("error", { code: "NOT_HOST" });
      return;
    }

    if (room.players.length < 2) {
      socket.emit("error", { code: "NOT_ENOUGH_PLAYERS" });
      return;
    }

    startMatchForRoom(room);
  });

  // ── Play Card (networked game) ──────────────────────────────
  socket.on("play_card", ({ roomId, cardId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.game) {
      socket.emit("error", { code: "GAME_NOT_RUNNING" });
      return;
    }
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) {
      socket.emit("error", { code: "NOT_IN_ROOM" });
      return;
    }
    const result = engine.playCard(room.game.state, `player-${player.seatIndex}`, cardId);
    if (result.error) {
      socket.emit("error", { code: "INVALID_MOVE", message: result.error });
      return;
    }
    room.game.state = result.state;
    io.to(roomId).emit("game_update", { gameId: room.game.gameId, gameState: room.game.state });
    scheduleTurnTimers(room);
  });

  // ── Restart Match ───────────────────────────────────────────
  socket.on("restart_match", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", { code: "ROOM_NOT_FOUND" });
      return;
    }
    const sender = room.players.find((p) => p.socketId === socket.id);
    if (!sender || !sender.isHost) {
      socket.emit("error", { code: "NOT_HOST" });
      return;
    }
    if (!room.game) {
      socket.emit("error", { code: "GAME_NOT_RUNNING" });
      return;
    }
    stopTurnTimers(room);
    const gameState = buildGameForRoom(room);
    room.game = { gameId: makeGameId(), state: gameState };
    io.to(roomId).emit("game_restarted", { roomId, gameId: room.game.gameId, gameState });
    scheduleTurnTimers(room);
  });

  // ── Disconnect ──────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const leaving = room.players.find((p) => p.id === playerId);

    // Mid-match disconnect: deal the leaver's cards out to the remaining players and keep the round going.
    if (room.game && leaving && typeof leaving.seatIndex === "number") {
      const seatId = `player-${leaving.seatIndex}`;
      if (room.game.state.phase === "playing") {
        stopTurnTimers(room);
        room.game.state = engine.redistributeCardsOnLeave(room.game.state, seatId);
        io.to(roomId).emit("game_update", { gameId: room.game.gameId, gameState: room.game.state });
        scheduleTurnTimers(room);
      }
    }

    // Remove player from room
    room.players = room.players.filter((p) => p.id !== playerId);

    console.log(`[DISCONNECT] ${playerId} left ${room.inviteCode}`);

    // If room is empty, delete it
    if (room.players.length === 0) {
      stopTurnTimers(room);
      waitingQueue.delete(room.id);
      rooms.delete(roomId);
      console.log(`[ROOM DELETED] ${room.inviteCode}`);
      return;
    }

    // If host left, assign new host
    if (!room.players.find((p) => p.isHost) && room.players.length > 0) {
      room.players[0].isHost = true;
    }

    syncQueue(room);

    io.to(roomId).emit("room_updated", { room: roomToJSON(room) });
  });
});

// ─── Health Check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", rooms: rooms.size, uptime: process.uptime() });
});

app.get("/rooms", (req, res) => {
  const list = [];
  for (const [, room] of rooms) {
    list.push({
      code: room.inviteCode,
      players: room.players.length,
      max: room.maxPlayers,
      started: room.started,
    });
  }
  res.json(list);
});

// ─── Start Server ──────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  🃏 GET AWAY THULLA Server`);
  console.log(`  ─────────────────────────`);
  console.log(`  Running on http://0.0.0.0:${PORT}`);
  console.log(`  WebSocket ready\n`);
});
