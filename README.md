# PartyGame — multiplayer mini-game foundation

A mobile-first, neo-brutalist Next.js 14 party-game platform with guest identities, Supabase Presence/Broadcast, LiveKit voice chat, Zustand state, and a React ↔ Phaser 3 bridge. **Tic-Tac-Toe (Doz) is fully implemented**; Air Hockey, Penalty Kick, and Chicken Run are represented in the game registry as locked, future-ready entries.

The project runs immediately without credentials in **local two-tab preview mode**. With credentials, the same lobby/game code switches to private Supabase Realtime channels and LiveKit voice.

---

## Quick start

```bash
cd partygame
npm install
npm run dev
```

Open `http://localhost:3000`, create a room, then open the room URL in a second tab. You will see:

- two random guest avatars;
- Presence-simulated player list and host election;
- Broadcast-style chat;
- localized game snapshots;
- a playable, host-authoritative Tic-Tac-Toe match;
- pause/reconnect/forfeit handling;
- a local Web Audio mic-level check when LiveKit is not configured.

No database is required for this mode. `LocalRoomTransport` uses `BroadcastChannel` between tabs and `localStorage` for game snapshots.

Useful commands:

```bash
npm run dev         # development server on 0.0.0.0:3000
npm run build       # production build
npm run start       # production server
npm run typecheck   # strict TypeScript check
npm run lint        # Next/React lint rules
npm test            # all three headless smoke tests
npm run test:rules  # pure Tic-Tac-Toe rules
npm run test:sync   # two-client host-authoritative sync
npm run test:local  # cross-tab local transport
```

---

## Supabase setup

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**.
3. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL Editor. It creates:
   - `public.rooms`;
   - `public.players`;
   - `public.game_states`;
   - `join_room`, `leave_room`, and version-gated `save_game_state` RPCs;
   - RLS policies based on `auth.uid()` and active room membership;
   - private Broadcast/Presence policies on `realtime.messages`.
4. In **Realtime → Settings**, disable **Allow public access** so only `private: true` channels are accepted.
5. Copy `.env.example` to `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
```

The browser calls `signInAnonymously()` and stores that session in `sessionStorage`, so each browser tab becomes a separate guest. The anonymous user id is also the Presence key, LiveKit identity, and RLS subject.

### Realtime channel contract

All rooms use one private channel: `room:<ROOM_CODE>` with `broadcast.self = true`.

| Event | Payload | Purpose |
| --- | --- | --- |
| `chat:message` | `ChatMessage` | Ephemeral text chat |
| `game:move` | `MoveIntent` | Client input intent |
| `game:state` | `TicTacToeState` | Host-authoritative snapshot |
| `game:state:request` | `StateRequest` | Late-join state recovery |
| `game:reset` | `ResetIntent` | New-round request |
| `game:tick` | `NetworkTick` | Future real-time games at max 20 TPS |

Payloads are validated with Zod in `src/lib/realtime/events.ts` before entering application state.

---

## LiveKit setup

Add the following to `.env.local`:

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_API_KEY=YOUR_KEY
LIVEKIT_API_SECRET=YOUR_SECRET
```

`POST /api/livekit-token` verifies the anonymous Supabase JWT, checks that the requested identity equals `auth.uid()`, and mints a short-lived token scoped to `partygame-<ROOM_CODE>`. The API secret is never sent to the browser.

`LiveKitVoiceStage` uses `useParticipants()`, `useSpeakingParticipants()`, participant `audioLevel`, `useTrackToggle()`, and `RoomAudioRenderer`. Speaking rings and level bars are shared with the player list through Zustand.

Without LiveKit/Supabase, the Voice tab shows a clearly labeled **local mic check**. It measures your microphone with Web Audio but does not transmit audio.

---

## Architecture

```text
Supabase Presence ─┐
Supabase Broadcast ┼─► RoomTransport ─► GameSessionController ─► Zustand store ─► Lobby UI
Local Broadcast    ┘                         │
                                            └─► GameBridge (typed EventEmitter)
                                                      ▲              │
                                          Phaser input │              ▼ authoritative state
                                                   TicTacToeScene
```

### Host-authoritative Tic-Tac-Toe

1. `pickLeader()` chooses the earliest connected Presence member as host.
2. A Phaser pointer emits `GameInput { type: "cell", cell }` into `GameBridge`.
3. `GameSessionController` turns it into a `MoveIntent` with a unique `moveId`.
4. `RoomTransport.sendMoveIntent()` broadcasts `game:move` using Supabase Broadcast.
5. Only the host runs the pure `applyMove()` reducer.
6. The host broadcasts and persists a versioned `game:state` snapshot.
7. Both clients render only snapshots with a newer version; duplicate `moveId`s are ignored.
8. A missing seat pauses the match for 10 seconds. Reconnect resumes it; expiry awards a forfeit.
9. New clients request the latest snapshot and also load `game_states` as a fallback.

`npm run test:sync` exercises this flow with two in-process clients, including replay protection and disconnect/reconnect behavior.

### React ↔ Phaser lifecycle

`src/components/game/GameCanvas.tsx` is the only Phaser owner:

- `phaser` and the Scene are dynamically imported inside `useEffect`;
- an async cancellation flag handles React StrictMode's double mount;
- `FIT` scaling preserves pointer coordinates on mobile;
- `ResizeObserver` refreshes the scale manager;
- `game.loop.sleep()` pauses the loop when a mobile bottom tab hides the game;
- cleanup emits `game:dispose`, calls `game.destroy(true)`, and clears the host;
- the Scene unsubscribes from every bridge listener on `SHUTDOWN`/`DESTROY`.

### Future mini-games

Add an entry to `src/lib/game/registry.ts`, create a Scene that takes `GameBridge`, and reuse the same transport/session layer. For real-time games, emit typed tick input and use `TickBroadcaster`, which coalesces numeric state into a maximum of **20 broadcasts/second**. Apply input locally in the Scene for client-side prediction, then reconcile against remote snapshots.

---

## Implementation chunks

See [`docs/IMPLEMENTATION.md`](./docs/IMPLEMENTATION.md) for a chunk-by-chunk architecture walkthrough and [`docs/CODE_CHUNKS.md`](./docs/CODE_CHUNKS.md) for a generated, copy-paste-friendly document containing the full source of every file in ordered implementation chunks.

Quick file map:

| Chunk | Files |
| --- | --- |
| 1. Database | `supabase/schema.sql` |
| 2. Env / guest auth | `.env.example`, `src/lib/env.ts`, `src/lib/supabase/client.ts`, `src/lib/identity.ts` |
| 3. Event contract | `src/lib/types.ts`, `src/lib/realtime/events.ts`, `src/lib/realtime/types.ts` |
| 4. Transports | `src/lib/realtime/SupabaseRoomTransport.ts`, `src/lib/realtime/LocalRoomTransport.ts` |
| 5. State / session | `src/store/createRoomStore.ts`, `src/lib/game/ticTacToe.ts`, `src/lib/game/GameSessionController.ts` |
| 6. Engine bridge | `src/lib/game/core/*`, `src/lib/game/registry.ts`, `src/components/game/GameCanvas.tsx`, `src/lib/game/scenes/TicTacToeScene.ts` |
| 7. Lobby UI | `src/components/room/*`, `src/components/home/*`, `src/app/globals.css` |
| 8. Voice | `src/components/room/LiveKitVoiceStage.tsx`, `src/components/room/VoicePanel.tsx`, `src/app/api/livekit-token/route.ts` |
| 9. Networking future | `src/lib/networking/TickBroadcaster.ts` |
| 10. Tests | `scripts/smoke-sync.cjs` |

---

## Production notes

- The SQL uses anonymous auth users rather than the unauthenticated `anon` role. This keeps guest mode frictionless while allowing real RLS.
- Private Realtime channels are only enforced when public access is disabled in Supabase settings.
- Text chat is intentionally ephemeral. Add a `chat_messages` table and moderation if persistence/history is required.
- Host authority currently lives in the client leader. For prizes or ranked matches, move validation into a Supabase Edge Function or database RPC.
- Add CAPTCHA/rate limiting for anonymous sign-ins and token minting before public launch.
- `public.delete_expired_rooms()` is provided for scheduled cleanup; wire it to `pg_cron` if desired.
