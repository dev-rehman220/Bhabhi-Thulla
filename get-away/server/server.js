const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

const PORT = process.env.PORT || 3001;

// ─── Room Store ────────────────────────────────────────────────
const rooms = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
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
    settings: { maxPlayers: room.maxPlayers },
    players: room.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      isHost: p.isHost,
      status: p.status,
    })),
  };
}

// ─── Socket Events ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // ── Join / Create Room ──────────────────────────────────────
  socket.on("join_room", ({ roomId, playerId, displayName, settings }) => {
    const maxPlayers = settings?.maxPlayers ?? 4;

    let room = rooms.get(roomId);

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

    // Check if player already in room
    const existing = room.players.find((p) => p.id === playerId);
    if (!existing) {
      if (room.players.length >= room.maxPlayers) {
        socket.emit("error", { code: "ROOM_FULL" });
        return;
      }
      room.players.push({
        id: playerId,
        displayName: displayName || "Player",
        isHost: room.players.length === 0,
        status: "active",
        socketId: socket.id,
      });
    } else {
      existing.socketId = socket.id;
    }

    // Join the socket room
    socket.join(roomId);
    socket.data = { roomId, playerId };

    console.log(`[JOINED] ${displayName} → ${room.inviteCode} (${room.players.length}/${room.maxPlayers})`);

    // Notify all players in room
    io.to(roomId).emit("room_updated", { room: roomToJSON(room) });
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

    room.started = true;
    console.log(`[MATCH STARTED] ${room.inviteCode} (${room.players.length} players)`);

    io.to(roomId).emit("match_started", {
      playerCount: room.players.length,
      players: room.players.map((p) => ({ id: p.id, name: p.displayName })),
    });
  });

  // ── Disconnect ──────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Remove player from room
    room.players = room.players.filter((p) => p.id !== playerId);

    console.log(`[DISCONNECT] ${playerId} left ${room.inviteCode}`);

    // If room is empty, delete it
    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`[ROOM DELETED] ${room.inviteCode}`);
      return;
    }

    // If host left, assign new host
    if (!room.players.find((p) => p.isHost) && room.players.length > 0) {
      room.players[0].isHost = true;
    }

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
