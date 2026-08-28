# Prompt: Online Play — Quick Match & Public Tables

Build a proper **online play** flow for Get Away Thulla (`get-away/`) that goes
beyond the current private-friends lobby: a **Quick Match** queue (auto-match
random opponents) plus the existing invite-code rooms, all backed by the current
Socket.IO server.

---

## Context

- Stack: Expo SDK 57 / React Native 0.86 / TypeScript (strict) / expo-router /
  react-native-reanimated / NativeWind / `socket.io-client`, with a
  Socket.IO **Node.js server** in `get-away/server/` (Express + Socket.IO,
  default port 3001, currently hosted at `http://130.210.23.189:3001`).
- The whole game UI lives in a single mega-screen with stage switching in
  `get-away/src/app/index.tsx` (stages: `splash | onboarding | menu | lobby |
  game | settings | stats | howtoplay | betting | profile`). Follow that
  pattern — do **not** move to separate router screens.
- A "PLAY ONLINE" card already exists on the main menu (left column, wired today
  to `onOnline` → the private `lobby`). This prompt upgrades that entry point
  into a real online-queue experience.
- Solo engine: `get-away/src/game/gameEngine.ts`. Server engine:
  `get-away/server/gameEngine.js` (plain-JS port). Server rooms/state:
  `get-away/server/server.js`.
- Existing private-room flow to imitate/reuse: `FriendsLobby` in `index.tsx`
  (creates `join_room` with `roomId: room_<playerId>`, shareable invite code,
  `match_started` event, `seatIndexByPlayerId`, restart/match lifecycle in
  server). Profiles (name/avatarId) are already transmitted and rendered.

## Goals

1. **Quick Match**: a player taps PLAY ONLINE → either joins an open public
   table with vacant seats OR the server creates/fills a fresh one for them.
2. **Public tables roster** (recommended): a small "OPEN TABLES" list showing
   games waiting for players (host name, seats filled/required); tap to join.
3. **Private rooms** stay as-is (invite code flow) but become reachable through
   the same ONLINE hub (two tabs: QUICK MATCH / PLAY WITH FRIENDS).
4. Matchmaking must respect table rules: 2–6 players, server enforces minimum
   seats before starting (existing `Math.max(2, …)` seat logic stays).
5. Everything must keep working offline/solo — online is additive.

## Out of scope (do NOT build)

- Accounts, logins, friend lists, chat, voice, ranking ELO ladder, payments.
- Server-side bots/auto-fill that start matches without enough humans.
- Reconnection-after-full-disconnect recovery beyond the existing socket client.

---

## Implementation plan (follow closely)

### 1. Server — matchmaking (`get-away/server/server.js`)

- Add a `waitingQueue` (array of roomIds that currently have `1 <= players <
  maxPlayers` seats filled and are public).
- New events:
  - `quick_match` {playerId, displayName, avatarId, maxPlayers} →
    - pick first room in `waitingQueue` that has a free seat and is not in a
      running match; if none, create `join_room` with a fresh `room_id` (also
      add it to the queue).
    - On success emit to that room `matchmaking_joined` {roomId, inviteCode,
      players} so the joiner can render the table/lobby.
  - `leave_matchmaking` {playerId} → remove the player's pending room from the
    queue (used when the client cancels before the match starts).
- When a room fills to capacity or a match starts, remove it from `waitingQueue`.
- Broadcast a light `online_players` counter every few seconds (total connected
  sockets) → `server.onlineCount` / socket.emit or room broadcast, so the ONLINE
  hub can show "X players online".

### 2. Client — ONLINE hub (`get-away/src/app/index.tsx`)

- Add stage `"online"` (and keep `"lobby"` for the private section if desired).
- Menu "PLAY ONLINE" card → `setStage("online")`.
- `OnlinePage` (new inline component, same visual language as `FriendsLobby`):
  - Header: 🌐 PLAY ONLINE + live "N players online" pill (`online_players`).
  - **QUICK MATCH** panel:
    - table-size selector (2–6) defaulting to 4.
    - big glowing "FIND A TABLE" button → `quick_match`; while waiting, show a
      spinner/pulse state and a CANCEL button (`leave_matchmaking`).
    - On `matchmaking_joined`, transition the same way the private lobby does
      (render players, THEN host START / auto-start).
  - Tabs/secondary button to reach the existing private **PLAY WITH FRIENDS**
    lobby (reuse `FriendsLobby` unchanged or embedded). Private flow must keep
    `join_room` with room codes.
  - Reuse profile name/avatarId on every `quick_match`/`join_room` emit.
- After `match_started` (same event as today) start `GameView` with the existing
  `NetworkInfo`. No gameplay changes needed — the table already handles
  arbitrary seat counts down to 2 players.

### 3. Lobby polish (recommended)

- In the waiting/lobby view, show "waiting for N more players …" with the
  current filled/total seats per table.
- When the host leaves matchmaking without starting, other queued players should
  be re-queued automatically (server reassigns the next open table).

### 4. Verification to run

- `npm run typecheck` — must pass with no new errors.
- `npm run lint` — no NEW errors vs. baseline (pre-existing errors exist in
  `FeedbackSummary.tsx`, `ConfirmDialog.tsx`, and regions of `index.tsx`; do not
  add more).
- `node --check get-away/server/server.js` and `get-away/server/gameEngine.js`.
- Server smoke test: two clients use `quick_match` and land in the same room;
  a third fills any gap; a 2-player match starts only when the host starts it.
- Manual: PLAY ONLINE → quick match with a second device → both sit at the same
  table; rematch/leave flows intact; solo PLAY VS CPU unaffected.

---

## Acceptance criteria

- [ ] PLAY ONLINE opens an ONLINE hub with Quick Match + access to private rooms.
- [ ] Tapping FIND A TABLE waits, auto-joins/creates a public table, and
      transitions into the room view (seats + invite code shown).
- [ ] Two+ devices using Quick Match end up on the same table; match starts once
      the host starts (2-player minimum respected).
- [ ] CANCEL during matchmaking stops waiting (server queue cleaned up).
- [ ] Live "players online" pill updates and is accurate enough.
- [ ] Existing private invite-code flow, profile avatars/names, and solo mode
      all still work.
- [ ] `typecheck` passes; no new lint errors; server syntax-validated.