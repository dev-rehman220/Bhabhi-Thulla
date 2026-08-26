const { io } = require("socket.io-client");

const SERVER = "http://localhost:3001";
const results = [];

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { transports: ["websocket"], timeout: 5000 });
    socket._name = name;
    socket.on("connect", () => {
      log(`${name} connected (id=${socket.id.slice(0, 6)})`);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      log(`${name} CONNECTION ERROR: ${err.message}`);
      reject(err);
    });
    socket.on("room_updated", ({ room }) => {
      log(`${name} got room_updated: ${room.players.length}/${room.settings.maxPlayers} players [${room.players.map((p) => p.displayName + (p.isHost ? "*" : "")).join(", ")}]`);
      results.push({ event: "room_updated", playerCount: room.players.length });
    });
    socket.on("join_success", ({ room }) => {
      log(`${name} got join_success: code=${room.inviteCode}`);
      results.push({ event: "join_success", code: room.inviteCode });
    });
    socket.on("match_started", (data) => {
      log(`${name} got match_started: ${data.playerCount} players`);
      results.push({ event: "match_started", playerCount: data.playerCount });
    });
    socket.on("found_room", ({ roomId }) => {
      log(`${name} got found_room: ${roomId.slice(0, 20)}...`);
      results.push({ event: "found_room" });
    });
    socket.on("error", ({ code }) => {
      log(`${name} got error: ${code}`);
      results.push({ event: "error", code });
    });
  });
}

async function run() {
  log("=== Starting 3-player room test ===");

  // Step 1: Host creates room
  log("--- Step 1: Host creates room ---");
  const host = await connect("HOST");
  host.emit("join_room", {
    roomId: "room_test_host",
    playerId: "host_001",
    displayName: "HostPlayer",
    settings: { maxPlayers: 3 },
  });
  await new Promise((r) => setTimeout(r, 500));

  // Step 2: Guest 1 joins by code (get code from room_updated)
  log("--- Step 2: Guest1 joins by code ---");
  const guest1 = await connect("GUEST1");
  // First get the room code from the host's room_updated event
  // We'll use a hardcoded test code - but let's query /rooms first
  const resp = await fetch(`${SERVER}/rooms`);
  const rooms = await resp.json();
  log(`Rooms on server: ${JSON.stringify(rooms)}`);

  if (rooms.length > 0) {
    const code = rooms[0].code;
    log(`Guest1 joining with code: ${code}`);
    guest1.emit("join_by_code", { code, playerId: "guest1_001" });
    await new Promise((r) => setTimeout(r, 500));
    // After found_room, need to emit join_room
    guest1.emit("join_room", { roomId: rooms[0].code ? `room_test_host` : "unknown", playerId: "guest1_001", displayName: "Guest1" });
    await new Promise((r) => setTimeout(r, 500));
  }

  // Step 3: Guest 2 joins directly
  log("--- Step 3: Guest2 joins directly ---");
  const guest2 = await connect("GUEST2");
  guest2.emit("join_room", {
    roomId: "room_test_host",
    playerId: "guest2_001",
    displayName: "Guest2",
  });
  await new Promise((r) => setTimeout(r, 500));

  // Step 4: Check room state
  log("--- Step 4: Check room state ---");
  const resp2 = await fetch(`${SERVER}/rooms`);
  const rooms2 = await resp2.json();
  log(`Rooms: ${JSON.stringify(rooms2)}`);

  // Step 5: Host starts match
  log("--- Step 5: Host starts match ---");
  host.emit("start_match", { roomId: "room_test_host" });
  await new Promise((r) => setTimeout(r, 1000));

  // Summary
  log("=== Test Complete ===");
  log(`Total events received: ${results.length}`);
  const matchStarted = results.filter((r) => r.event === "match_started");
  log(`match_started events: ${matchStarted.length} (expected 3)`);
  const roomUpdated = results.filter((r) => r.event === "room_updated");
  log(`room_updated events: ${roomUpdated.length}`);

  // Cleanup
  host.disconnect();
  guest1.disconnect();
  guest2.disconnect();

  const allPassed = matchStarted.length === 3 && rooms2.length >= 1 && rooms2[0].players === 3;
  log(`\nResult: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
