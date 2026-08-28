# Prompt: Player Profile System (Name + Avatar)

Implement a persistent **player profile system** for the Get Away Thulla Expo app
(`get-away/`) so each player can set a display name and pick an avatar that
appears on their own menus **and across all players** in online rooms (lobby +
table).

---

## Context

- Stack: Expo SDK 57 / React Native 0.86 / TypeScript (strict) / expo-router /
  react-native-reanimated / NativeWind / `socket.io-client`, with a
  Socket.IO **Node.js server** in `get-away/server/` (Express + Socket.IO).
- The entire game UI is a single-mega-screen with stage switching in
  `get-away/src/app/index.tsx` (stages: `splash | onboarding | menu | lobby |
  game | settings | stats | howtoplay | betting`). Follow that existing pattern —
  do **not** move the game to separate router screens.
- Persistence pattern to imitate: `get-away/src/utils/gameStats.ts` and
  `get-away/src/utils/coinWallet.ts` (AsyncStorage + `useState` in the screen).
- `expo-image` is already a dependency and is the right component to render the
  WebP avatars on every platform (incl. web).
- Solo game engine: `get-away/src/game/gameEngine.ts` (type `GamePlayer`).
  Server engine: `get-away/server/gameEngine.js` (plain-JS port).
- Server room/state: `get-away/server/server.js`.

## Asset first step

The 9 avatars currently live OUTSIDE the Expo project at
`Assets/Avatars/avatar1.webp … avatar9.webp` (repo root, Unity folder).
Files outside `get-away/` are NOT bundled by Expo, so:

1. Copy (or move) them into `get-away/assets/images/avatars/avatar1.webp … avatar9.webp`.
2. WebP is fine for `expo-image` on iOS/Android/web — keep the format.

## Goals

1. A profile = **display name** + **avatarId** (string like `"1"`…`"9"`),
   persisted locally with AsyncStorage.
2. A "Profile" editor screen where the player:
   - edits their name (trimmed, ~16 chars max),
   - picks one of the 9 avatars from a grid (selected one highlighted),
   - saves or cancels.
3. The name + avatar appear for the **local player** in the menu and in-game.
4. In **online play** the chosen name + avatarId are sent to the server and shown
   to **all players** in the room — in the lobby player list and at the table
   (player badges and the human seat bar).
5. Only the **avatarId** is transmitted (a 1–9 string). The actual image files
   stay bundled in each client; every client maps id → local image. No uploads,
   no CDN, no server-side file storage.

## Out of scope (do NOT build)

- Accounts, login, authentication, friends lists, social features.
- Server-hosted avatar image files / multipart uploads.
- Changing avatars at runtime inside a live match mid-game is allowed but not
  required; profile applies to the next room/table you join.

---

## Implementation plan (follow closely)

### 1. Avatar registry

Add a small registry (e.g. in `get-away/src/constants/avatars.ts`):

```ts
import type { GameCard } from "@/game/gameEngine"; // not needed here
export const AVATAR_IDS = ["1","2","3","4","5","6","7","8","9"] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export const AVATARS: Record<AvatarId, number> = {
  "1": require("@/assets/images/avatars/avatar1.webp"),
  "2": require("@/assets/images/avatars/avatar2.webp"),
  // ... 3–9
};
export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && (AVATAR_IDS as readonly string[]).includes(v);
}
```

(The `@/assets/*` path alias is already mapped to `./assets/*` in
`get-away/tsconfig.json` and is used elsewhere, e.g. `explore.tsx` requiring
`@/assets/images/...`.)

### 2. Profile store — `get-away/src/utils/profile.ts`

Model the existing `gameStats.ts` style (AsyncStorage, try/catch, defaults):

```ts
export interface Profile { name: string; avatarId: string }
```

- Key: `@get-away-thulla/profile`.
- Defaults: `{ name: "Player", avatarId: "1" }`.
- `loadProfile(): Promise<Profile>` (merge with defaults, validate `avatarId`
  via `isAvatarId`, clamp name to 16 chars, fall back to default on parse error).
- `saveProfile(p: Profile): Promise<void>` (store trimmed name + valid avatarId).

### 3. Type changes

- `get-away/src/game/gameEngine.ts` — add `avatarId?: string` to the `GamePlayer`
  type so server-broadcast state can carry avatars per seat.
- `get-away/server/gameEngine.js` — the plain-JS port doesn't need a type change;
  just ensure `avatarId` flows through player objects (spreads already copy it).
- Update the solo `createGame(playerCount, profile?)` optional param: seat 0 name
  = `profile.name ?? "YOU"`, `avatarId = profile.avatarId`. Leave other seats as
  `CPU n`.

### 4. Client state + profile editor UI

In `get-away/src/app/index.tsx`:

- Add stage `"profile"` to the `Stage` union, and wire it into the final stage
  dispatcher (`if (stage === "profile") return <ProfilePage … />`).
- Load profile once with `loadProfile()` alongside the existing `loadStats` /
  `claimWelcomeBonus` effect; keep it in state (`profile`, with a setter).
- Add a `ProfilePage` component (new file `src/components/ProfilePage.tsx` is
  fine, or inline in `index.tsx` per the file's existing style):
  - Header "PROFILE" + current avatar & name preview (matching existing visuals:
    dark felt theme — reuse the `T` palette / `fs`/`rs` helpers or pass colors in).
  - `TextInput` for the name (reuse the room-code TextInput styling pattern).
  - Grid of 9 avatars rendered with `expo-image` `<Image>`, circular crop,
    border highlight on the selected one.
  - SAVE (persists via `saveProfile`, returns to previous stage) and BACK/CANCEL.
  - Guard: name must be non-empty after trim; keep it ≤ 16 chars.
- Surface profile in menu: MenuView top bar — replace/extend the `PRO` chip and
  HamburgerMenu with a profile chip showing the avatar + name, and a "Profile"
  menu item that opens the editor. (Hamburger items are already wired to
  `onSettings/onStats/…` — add `onProfile`.)
- `SettingsPage` may also expose a "Profile" row that jumps to the editor (optional).

### 5. Online flow (name + avatar across users)

- `FriendsLobby`:
  - Replace the hardcoded `const [name] = useState("Player")` with the loaded
    `profile.name`.
  - Send `avatarId` in `join_room` (alongside `displayName`).
  - `NetworkInfo` type: add `avatarId`.
  - Lobby player list rows: render each `RoomPlayer`'s avatar + displayName
    (fall back to the existing initial-letter chip when missing).
- `get-away/server/server.js`:
  - `join_room`: accept + store `avatarId` on the player record (default `"1"`).
  - `roomToJSON`: include `avatarId` per player.
  - `buildGameForRoom`: after the engine builds seats and CPUs are assigned,
    rename each seat to the live player's real `displayName` (instead of the
    engine's generic `PLAYER n`) and set `player.avatarId` from the room record
    for occupied seats. Keep the CPU-filler logic intact.
  - `match_started` payload already returns `players: [{id, name}]` — extend to
    include `avatarId`; `game_update` broadcasts `gameState` wholesale, which now
    carries names + `avatarId` on `players` automatically.
  - Handle missing/`undefined` avatarId defensively on join (clamp to valid id /
    default `"1"`).
- `GameView`:
  - `PlayerBadge` component: accept an `avatarId`/`avatar` prop; when present
    render the avatar image (small circle) instead of the first-letter chip.
    Keep name + card count chips.
  - Human seat bar (bottom tray): show avatar + `profile.name`/`humanPlayer.name`.
  - Pass `avatarId` from `network.avatarId` / `gameState.players[i].avatarId`.

### 6. Solo mode

- Menu "PLAY VS CPU" → `createGame(playerCount, profile)` so seat 0 uses the
  player's name + avatar. Update `GameView` accordingly for
  `humanId === "player-0"` (no `network`).

### 7. Verification to run

- `npm run typecheck` (tsc --noEmit) — must pass with no new errors.
- `npm run lint` — no NEW errors vs. baseline (repo already has pre-existing
  lint errors in `FeedbackSummary.tsx`, `ConfirmDialog.tsx`, and some
  `index.tsx` regions; do not introduce more).
- `node --check get-away/server/server.js` and `gameEngine.js`.
- Manual: set name + avatar → restart app → still set (persistence).
- Manual 2-player room: host picks avatar/name, guest picks avatar/name →
  both see each other's avatar + name in the lobby and on the table; existing
  2-player gameplay (moves/tricks) still works.
- Optional: `get-away/server/test-gameplay.js` against a running server still
  reports ALL TESTS PASSED.

---

## Acceptance criteria

- [ ] Profile (name + avatar) persists across app restarts.
- [ ] Name ≤ 16 chars, trimmed; avatar selectable from all 9; save/cancel works.
- [ ] Local player's avatar + name visible in menu, lobby, and at the table.
- [ ] In a 2-player online room, each client renders the OTHER player's chosen
      avatar + name (not generic `PLAYER n`).
- [ ] Avatars render correctly on Android, iOS, and web (expo-image + WebP).
- [ ] `typecheck` passes; no new lint errors; server syntax-validated.