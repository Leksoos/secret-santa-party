# Project: Secret Santa Jackbox Party (Round 2: LAN Networking, Mobile UX, Dual-Screen & Simulator)

## Architecture
The application is a full-stack Jackbox-style holiday party game with Express/Socket.IO backend (`server/`) and React/Vite/Tailwind frontend (`src/`).
- **Server**: Express HTTP + Socket.IO on port 3001. State managed in-memory in `server/rooms.ts`.
- **Client**: React 18 SPA served by Vite on port 5173 with proxy to backend `/api`, `/uploads`, `/socket.io`.
- **Display Modes**:
  - `view=tv`: TV spectator mode (clean, broadcast screen without user session collisions).
  - Mobile Controller / Guest View: Player smartphone screen with quick-claim profile picker, custom questions, answers, and reactions.
  - Host Controller View: Master controls on mobile claimed via Host Dual-Screen QR.
- **Local Testing Bench**: Built-in floating Multi-Phone Simulator drawer to test 3–4 simulated phone clients directly in one browser tab.

## Feature Inventory
Every feature from user request ## 2026-09-26T09:23:11Z is assigned to a milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Local Wi-Fi IPv4 Detection | Auto-detect host machine IPv4 via `os.networkInterfaces()`, prioritizing Wi-Fi `en0`/`wlan0`, 192.168.x.x, 10.x.x.x | M1 | ORIGINAL_REQUEST §R1 |
| 2 | R1: `GET /api/network-info` | Expose endpoint returning IP, ports, URL, interfaces list, and tunnel overrides | M1 | ORIGINAL_REQUEST §R1 |
| 3 | R1: Env Overrides | Support `TUNNEL_URL` and `HOST_IP` environment variables | M1 | ORIGINAL_REQUEST §R1 |
| 4 | R1: Network Test Suite | Automated tests in `test/network-info.test.ts` testing IP heuristics, overrides, and HTTP API | M1 | ORIGINAL_REQUEST §Acceptance |
| 5 | R2: Smart QR LAN Adaptation | TV Lobby and Spectator screens replace `localhost` with detected LAN IP/tunnel URL | M2 | ORIGINAL_REQUEST §R2 |
| 6 | R2: Network Settings Modal ("⚙️ Сеть") | Discreet button and modal on TV view to switch IP interfaces or input custom tunnel URL | M2 | ORIGINAL_REQUEST §R2 |
| 7 | R4: Host Dual-Screen Phone QR | Dedicated "📱 Пульт ведущего" modal on TV view generating host controller claim URL | M2 | ORIGINAL_REQUEST §R4 |
| 8 | R4: Seamless Mobile Host Session | Claim host controller session on mobile without spectator session collisions | M2 | ORIGINAL_REQUEST §R4 |
| 9 | R3: "Кто ты? Выбери себя" Card Picker | Mobile card picker showing registered participants when entering room without profile | M3 | ORIGINAL_REQUEST §R3 |
| 10 | R3: One-Tap Check-in & Chime | Card click saves profile, fires check-in event with audio chime on TV, routes to controller | M3 | ORIGINAL_REQUEST §R3 |
| 11 | R5: Multi-Phone Party Simulator Drawer | Floating panel to simulate 3-4 participant phones locally (votes, reactions, quiz answers) | M3 | ORIGINAL_REQUEST §R5 |
| 12 | R6: Fullscreen API Toggle | Fullscreen toggle button (`⛶ Во весь экран`) with cross-browser support | M3 | ORIGINAL_REQUEST §R6 |
| 13 | R6: Screen Wake Lock API | Screen Wake Lock integration with `visibilitychange` re-acquisition | M3 | ORIGINAL_REQUEST §R6 |
| 14 | R6: Audio Autoplay Unblock Banner | Interactive banner on TV view to unblock browser AudioContext autoplay policies | M3 | ORIGINAL_REQUEST §R6 |
| 15 | Acceptance: Full Test Pass & Clean Build | `npm test` 100% across all 11 suites, `npm run build` succeeds cleanly | M4 | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Network Auto-Detection & Tests | `server/network.ts`, `server/index.ts`, `test/network-info.test.ts`, `package.json` | none | DONE |
| M2 | TV Smart QR, LAN Switch & Host Mobile QR | `src/lib/network.ts`, `NetworkSettingsModal.tsx`, `HostQrModal.tsx`, `TvShowView.tsx`, `Header.tsx`, `App.tsx` | M1 | IN_PROGRESS |
| M3 | Mobile Quick-Claim, Phone Simulator & Presentation UX | `ProfilePickerModal.tsx`, `MultiPhoneSimulator.tsx`, `useFullscreen.ts`, `useScreenWakeLock.ts`, `AudioUnblockBanner.tsx`, `App.tsx` | M2 | PLANNED |
| M4 | Final Integration, Test Pass & Verification | Full test suite execution, adversarial check, build verification, victory report | M1, M2, M3 | PLANNED |

## Interface Contracts
### Server Network API ↔ Client Network Library
- Endpoint: `GET /api/network-info`
- Query params: optional `?port=5173`
- Response Schema:
```json
{
  "success": true,
  "ip": "192.168.1.82",
  "port": 5173,
  "serverPort": 3001,
  "url": "http://192.168.1.82:5173",
  "tunnelUrl": null,
  "isOverridden": false,
  "interfaces": [
    { "name": "en0", "address": "192.168.1.82", "family": "IPv4", "score": 150 }
  ]
}
```

### TV Spectator ↔ Host Mobile Controller Handshake
- Host QR URL: `${baseUrl}/?code=${room.code}&role=host&hostId=${room.hostId}&tab=controller`
- Mobile action: If `role === 'host'`, store `santa_participant_id = hostId`, set `activeTab = 'controller'`, and bypass profile picker.

### Mobile Quick-Claim Handshake
- Trigger: Client has `code`, `participantId` is not in localStorage, room participants > 0.
- Selection: User clicks `participantId` -> stores `santa_participant_id` in localStorage, calls `POST /api/rooms/:code/checkin`, emits TV chime, routes to controller.

### Multi-Phone Simulator ↔ Socket.IO
- Payload: `party:quiz_answer`, `party:guess`, `party:reaction` with explicit `participantId` for `demo-oleg`, `demo-elena`, `demo-dima`, `demo-anya`.

## Code Layout
- `server/network.ts`: Interface detection, heuristic scoring, `getNetworkInfo()`.
- `server/index.ts`: HTTP endpoints (`/api/network-info`).
- `test/network-info.test.ts`: Automated test suite for network info and overrides.
- `src/lib/network.ts`: Client network info fetcher and `computeBaseUrl`.
- `src/components/NetworkSettingsModal.tsx`: Network IP / tunnel modal on TV screen.
- `src/components/HostQrModal.tsx`: Host controller QR code modal.
- `src/components/ProfilePickerModal.tsx`: "Кто ты? Выбери себя" card picker.
- `src/components/MultiPhoneSimulator.tsx`: Local testing bench drawer.
- `src/components/AudioUnblockBanner.tsx`: AudioContext unblock banner.
- `src/hooks/useFullscreen.ts`: Fullscreen toggle hook.
- `src/hooks/useScreenWakeLock.ts`: Wake Lock API hook.
- `src/views/TvShowView.tsx`: TV spectator view integrations.
- `src/App.tsx`: App routing, profile picker trigger, host claim handling.
