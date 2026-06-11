# Anchor — Codebase Research

> **Project path:** `hongDev/anchor-app/`
> **As of:** 2026-05-08

---

## 1. What This App Is

**Anchor** is a hardware-inspired focus-timer app built with Expo + React Native. The core idea is that digital focus sessions should feel like interacting with a calm, physical precision device rather than a flat SaaS productivity tool.

Every design decision — layered ceramic shadows, SVG LED indicators, Geist Mono labels, mechanical digit counters — is intentionally referencing Braun / Teenage Engineering aesthetics. The app uses your phone's accelerometer to enforce physical stillness during a session, applying time penalties if you move the device.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo ~54.0.33 |
| Runtime | React Native 0.81.5 |
| Language | TypeScript ~5.9 |
| Routing | expo-router ~6.0.23 (file-based) |
| Persistence | @react-native-async-storage/async-storage 2.2.0 |
| Motion | expo-sensors ~15.0.8 (Accelerometer) |
| Audio | expo-av ~16.0.8 |
| Haptics | expo-haptics ~15.0.8 |
| SVG | react-native-svg 15.12.1 |
| Gradients | expo-linear-gradient ~15.0.8 |
| Animation | react-native-reanimated ~4.1.1 + Animated API |
| Architecture | New Architecture enabled, React Compiler enabled |

**Dev dependencies:** TypeScript 5.9, ESLint 9 (expo config)

---

## 3. Project Structure

```
hongDev/anchor-app/
├── app/
│   ├── _layout.tsx            Root Stack; loads fonts, sets navigation theme
│   ├── manage-data.tsx        Data/reset screen (stack-only, not a tab)
│   ├── modal.tsx              Placeholder modal
│   └── (tabs)/
│       ├── _layout.tsx        Tab bar config (4 visible + 3 hidden tabs)
│       ├── index.tsx          → DashboardScreen
│       ├── session.tsx        → SessionScreen
│       ├── recent.tsx         → RecentScreen
│       ├── account.tsx        → AccountScreen
│       ├── timer.tsx          TimerScreen (self-contained, hidden from tab bar)
│       ├── explore.tsx        (hidden, unused placeholder)
│       └── settings.tsx       (hidden, unused placeholder)
│
├── components/
│   ├── intent/
│   │   ├── CeramicButton.tsx  Primary button primitive
│   │   ├── HardwareLed.tsx    SVG LED indicator (static)
│   │   ├── EmptyState.tsx     Empty-list placeholder
│   │   ├── format.ts          Duration/date formatters
│   │   └── theme.ts           Re-exports constants/theme + adds layout/sageSoft/clay tokens
│   ├── screens/
│   │   ├── DashboardScreen.tsx
│   │   ├── SessionScreen.tsx
│   │   ├── RecentScreen.tsx
│   │   └── AccountScreen.tsx
│   ├── haptic-tab.tsx         Tab bar button with haptic feedback
│   ├── themed-text.tsx        Adapter from Expo template (largely unused)
│   ├── themed-view.tsx        Adapter from Expo template (largely unused)
│   └── ui/
│       ├── icon-symbol.tsx    SF Symbols / MaterialIcons cross-platform
│       └── icon-symbol.ios.tsx
│
├── constants/
│   ├── theme.ts               Primary design token source
│   └── fonts.ts               Font family constants + asset map
│
├── services/
│   └── storage.ts             All AsyncStorage I/O (stats, history, friends, session)
│
├── hooks/
│   ├── use-color-scheme.ts
│   └── use-color-scheme.web.ts
│
├── assets/
│   ├── fonts/Geist/           18 OTF weights (loaded subset: Regular, Medium, Bold, Black)
│   ├── fonts/GeistMono/       18 OTF weights (loaded subset: Regular, Medium, Bold)
│   └── sounds/                success.mp3, warning.mp3, end.mp3
│
├── tsconfig.json              Strict mode, path alias @/ → ./
├── app.json                   Expo config (scheme: detoxapp)
└── package.json               (name: detox-app)
```

---

## 4. Navigation Architecture

```
Stack (app/_layout.tsx)
 ├── (tabs)/               ← headerShown: false
 │    ├── index (Dashboard)
 │    ├── session (Session setup)
 │    ├── recent (History)
 │    ├── account (Profile)
 │    └── timer            ← href: null  (not reachable from tab bar)
 ├── manage-data           ← pushed from Account screen
 └── modal
```

**Timer navigation:** `SessionScreen` calls:
```ts
router.push({
  pathname: '/timer',
  params: { sessionId, durationSeconds, rewardPoints, purpose?, note? }
})
```
Return: `router.replace('/')` from timer results screen.

---

## 5. Screen Reference

### 5.1 Dashboard (`DashboardScreen.tsx`)
- Loads stats + session history on `useFocusEffect`
- Shows total points, current streak, today's session count/time/points
- Hero CTA: "Start session" → pushes to `/session`

### 5.2 Session Setup (`SessionScreen.tsx`)
- Custom `WheelPicker` for hours (0–12) and minutes (0–59), min 5 min, max 720 min (12h)
- Default: 30 minutes
- Purpose chips: Study, Work, Reading, Sleep (single-select toggle)
- Note field: free-text multiline TextInput with ceramic depth treatment
- `RewardCounter`: animated 5-digit mechanical display showing estimated points
- Confirm modal shows full summary before starting
- All wrapped in `SafeAreaView + ScrollView` with `keyboardShouldPersistTaps="handled"`

### 5.3 Timer (`app/(tabs)/timer.tsx`)
Self-contained (no separate screen component). Accepts route params.

#### Key constants (at top of file):
```ts
const TEST_MODE = true;              // ← MUST be false before production
const TEST_DURATION_SECONDS = 10;
const STILL_THRESHOLD = 0.08;        // sum of |Δx|+|Δy|+|Δz|
const SENSOR_INTERVAL_MS = 350;
const MOVEMENT_WARNING_SECONDS = 5;  // grace period before penalty
const MAX_PENALTY_COUNT = 5;         // auto-end after 5 penalties
const TOTAL_PROGRESS_TICKS = 48;     // segments in progress ring
```

#### Session lifecycle:
1. Mount → `initializeSession()`: loads stored session or creates fresh one
2. `status: 'loading'` → reads AsyncStorage → `status: 'running'`
3. 1-second interval updates countdown via `getRemainingSeconds(endTime)`
4. Accelerometer fires every 350ms; if delta > 0.08 → 5s countdown to penalty
5. Penalty: +15% of `countdownDurationSeconds` added to `endTime`
6. At 5 penalties: `endSessionWithPartialReward('penalties')`
7. Manual quit: "I failed" → `endSessionWithPartialReward('manual')`
8. Timer hits 0: `completeSuccess()`
9. Navigate away while running → `useFocusEffect` cleanup fires partial reward

#### Session states:
| State | Meaning |
|---|---|
| `loading` | Restoring from AsyncStorage |
| `running` | Active countdown |
| `success` | Reached zero — full reward |
| `ended` | Quit manually or 5 penalties — partial reward |

#### LED pulsing (timer-local):
```
Animated.loop(sequence([
  timing(opacity, { toValue: 0.12, duration: 820 }),
  timing(opacity, { toValue: 1, duration: 820 }),
]))
```
Sage tone = success, orange tone = ended.

### 5.4 Recent (`RecentScreen.tsx`)
- Filter tabs: All / Completed / Ended early / Too many penalties
- Shows duration, purpose pill (if set), note (if set), date, completion time, penalty count, points earned
- Max 50 sessions from storage (sorted newest first)

### 5.5 Account (`AccountScreen.tsx`)
- Stats grid: total points, streak, session count, badge count
- Invite code display + native share sheet
- "Add friend by code" with TextInput
- Friend leaderboard (sorted by totalPoints desc)
- Achievements grid (5 total, derived dynamically)
- Sound effects toggle (visual-only toggle, no react-native Switch)
- "Data & Privacy" → navigates to `/manage-data`

### 5.6 Manage Data (`manage-data.tsx`)
Reset actions (all with Alert confirmation):
- Reset points only
- Reset streak only
- Reset session history
- Reset all (points + streak + history + friends + invite code + active session + sound pref)

**Note:** Contains `console.log` debug statements.

---

## 6. Design System

### 6.1 Color Palette (`constants/theme.ts`)

```ts
background:   '#F0EEE9'    // warm off-white — the app surface
panel:        '#F0EEE9'    // same as background
surface:      '#F0EEE9'    // same as background
surfaceInset: '#E4E1DA'    // slightly deeper warm — recessed field color
ink:          '#111312'    // near-black text
muted:        '#666B67'    // secondary text
faint:        '#9A9D99'    // placeholder/tertiary
line:         rgba(17,19,18, 0.08)
sage:         '#4F7D70'    // green — success, active, CTA
orange:       '#FF5A2D'    // warning, penalty, fail
yellow:       '#EAB308'
successSoft:  '#E3E9E2'    // background tint on success screen
warningSoft:  '#EADDD5'    // background tint on ended screen
```

**Note:** `components/intent/theme.ts` defines slightly different values for ink/muted/sage and adds `sageSoft`, `clay`, `claySoft`. These are used by Dashboard, Recent, Account, Manage Data screens. `constants/theme.ts` is used by Session and Timer screens and CeramicButton.

### 6.2 Typography Scale

| Token | Font | Size | Weight | Features |
|---|---|---|---|---|
| `screenTitle` | GeistBlack | 30 | 900 | — |
| `panelLabel` | GeistMonoMedium | 11 | 500 | UPPERCASE, letterSpacing 0.9 |
| `valueLarge` | GeistBlack | 48 | 900 | — |
| `timerValue` | GeistBlack | 54 | 900 | letterSpacing 0.1 |
| `cardTitle` | GeistBold | 17 | 700 | — |
| `body` | GeistRegular | 14 | 400 | — |
| `meta` | GeistMonoMedium | 12 | 500 | letterSpacing 0.35 |
| `button` | GeistBold | 16 | 700 | letterSpacing 0.2 |
| `chip` | GeistMedium | 11 | 500 | letterSpacing 0.15 |
| `instrumentLabel` | GeistMonoMedium | 11 | 500 | UPPERCASE, letterSpacing 0.9 |

### 6.3 Spacing Scale

```
xs: 4   sm: 8   md: 12   lg: 16   xl: 24   xxl: 32
screenPadding: 20   panelPadding: 18   cardGap: 14   controlGap: 10
```

### 6.4 Border Radius

```
panel: 28   card: 22   control: 16   button: 18   smallButton: 12
pill: 999   dial: 999
```

### 6.5 Shadow Presets

```ts
panel:         { shadowOpacity: 0.09, shadowRadius: 18, offset: {0, 10}, elevation: 4 }
raisedControl: { shadowOpacity: 0.10, shadowRadius: 8,  offset: {0,  4}, elevation: 3 }
button:        { shadowOpacity: 0.10, shadowRadius: 10, offset: {0,  5}, elevation: 3 }
pressed:       { shadowOpacity: 0.08, shadowRadius: 5,  offset: {0,  2}, elevation: 1 }
dial:          { shadowOpacity: 0.18, shadowRadius: 24, offset: {0, 12}, elevation: 5 }
```

---

## 7. Hardware Depth Effect Pattern

The "ceramic / recessed" look appears consistently across CeramicButton, wheel pickers, note field, reward digits, and the timer dial. The layers (inside-out):

```
Layer 1 — Outer shell
  LinearGradient(['#DEDAD0', '#F6F3EC'], top→bottom)
  Creates warm bevel tint

Layer 2 — Contact gap  (absolute fill, inset by ~4-6px)
  Semi-transparent dark: rgba(34,31,26,0.035)
  shadowOpacity: 0.12, shadowRadius: 4, offset: {0, 2}
  Simulates the shadow line where surfaces meet

Layer 3 — Cavity shadow  (absolute fill, inset by 1px more than gap)
  rgba(17,19,18,0.018) + shadow {shadowOpacity:0.16, shadowRadius:4, offset:{1,2}}
  Deepens the recessed illusion

Layer 4 — Inner field  (content surface)
  backgroundColor: '#E4E0D8' or '#F0EEE9'
  + top-shade gradient: rgba(17,19,18,0 → 0.095) fading down
  + bottom-highlight: rgba(255,255,255,0 → 0.2) fading up
  + optional glass sheen overlays
```

**Rule:** Never use hard border strokes. Use gradient + shadow layering only.

---

## 8. Reusable Primitives

### `CeramicButton` (`components/intent/CeramicButton.tsx`)

```ts
type CeramicButtonSize = 'large' | 'largeCompact' | 'medium' | 'small';

<CeramicButton
  size="medium"            // default
  onPress={handler}
  label="Text"             // OR use children
  surfaceStyle={...}       // override the inner row (e.g. add gap/padding for chips)
  textStyle={...}          // override the default label style
  style={...}              // override the outer Pressable
/>
```

Press animation: `{ translateY: 2, scale: 0.985 }` + reduced shadow.
The layering is: `Pressable > LinearGradient seat > View contactGap > LinearGradient bevel > View surface > children`.

### `HardwareLed` (`components/intent/HardwareLed.tsx`)

```ts
<HardwareLed
  isOn={true}        // default true; false dims to gray
  size="small"       // 'small' (15px) or 'medium' (17px)
  tone="orange"      // 'orange' or 'sage'
/>
```

The timer screen has its own inline `HardwareLed` with animated `Animated.Value` for pulsing — that one takes `{ isPulsing, pulseOpacity, tone }` props.

### `HardwareProgressRing` (timer-local)
48-tick SVG ring. Active ticks use sage/orange at 54% opacity, inactive at 7%.

### `WheelPicker` (SessionScreen-local)
Custom scroll-based picker with settle-to-nearest logic, haptic feedback on tick change, and hardware depth treatment. Refs: `scrollRef` passed from parent.

### `RewardDigit` / `RewardCounter` (SessionScreen-local)
5-digit mechanical counter. Each digit animates `translateY: 8→0` + opacity on change with `Easing.out(Easing.cubic)` at 180ms.

### `EmptyState` (`components/intent/EmptyState.tsx`)
```ts
<EmptyState title="No sessions yet" body="Descriptive message." />
```

---

## 9. Storage Layer

**File:** `services/storage.ts`

### AsyncStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `intent.stats.v1` | `Stats` | totalPoints, currentStreak, lastSuccessDate |
| `intent.sessionHistory.v1` | `SessionRecord[]` | Up to 50 records |
| `intent.inviteCode.v1` | `string` | User's own code (`ANCHOR-XXXXXX`; legacy `INTENT-XXXXXX` remains accepted) |
| `intent.friends.v1` | `Friend[]` | Local-only friend list |
| `intent.activeSession.v1` | `ActiveSession` | Timer in-progress (backgrounding survival) |
| `intent.soundEffects.v1` | `'true'` / `'false'` | Sound toggle |

### Data Types

```ts
type Stats = {
  totalPoints: number;
  currentStreak: number;
  lastSuccessDate: string | null;  // 'YYYY-MM-DD' local date
};

type SessionRecord = {
  id: string;
  date: string;                     // ISO timestamp
  durationSeconds: number;
  completedSeconds: number;
  status: 'success' | 'partial' | 'ended';
  pointsEarned: number;
  penaltyCount: number;
  purpose?: string;
  note?: string;
};

type Friend = {
  id: string;
  inviteCode: string;
  addedAt: string;
  displayName: string;
  currentStreak: number;
  totalPoints: number;
};
```

### Points Formula

```ts
calculateRewardPoints(durationMinutes: number): number
  basePoints = minutes * 2
  multiplier:
    < 30 min  → ×1.0
    ≥ 30 min  → ×1.2
    ≥ 60 min  → ×1.5
    ≥ 120 min → ×2.0
    ≥ 240 min → ×2.5
  return Math.round(basePoints * multiplier)
```

Examples: 30 min = 72 pts, 60 min = 180 pts, 120 min = 480 pts, 4h = 1200 pts.

### Streak Logic

- `applySuccess(durationMinutes)`: adds points + increments streak only if no success today
- `applyPartialReward(points)`: adds points only, no streak change
- `applyFailure()`: resets streak to 0 and clears `lastSuccessDate` (**not called from any UI currently**)
- Date key: `getLocalDateKey()` = `YYYY-MM-DD` from `new Date()` local time

### Partial Reward Formula (timer.tsx)

```ts
partialPoints = Math.round(rewardPoints * (completedSeconds / durationSeconds) * 0.25)
```
Max 25% of full reward, proportional to elapsed time.

### Achievements

All 5 achievements are derived dynamically from `(stats, history)` — no stored flag:

| ID | Title | Unlock Condition |
|---|---|---|
| `first-detox` | First Detox | At least 1 successful session |
| `one-hour-club` | 1 Hour Club | Any successful session ≥ 60 min |
| `deep-focus` | Deep Focus | Any successful session ≥ 120 min |
| `comeback` | Comeback | A `partial`/`ended` session followed immediately by `success` (chronological) |
| `streak-3` | Streak 3 | `currentStreak >= 3` |

### Friends System (local-only)

Invite code format: `ANCHOR-` + 6 chars from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Legacy `INTENT-` codes remain accepted for local compatibility.

Mock stats seeded from `charCodeAt` sum of the invite code:
```ts
displayName = `Friend ${inviteCode.slice(-4)}`
currentStreak = seed % 8
totalPoints = 120 + (seed % 24) * 35
```

No real backend. Adding your own code or a duplicate is silently rejected.

---

## 10. Motion Detection

```
Platform:     expo-sensors Accelerometer
Interval:     350ms
Delta calc:   Math.abs(Δx) + Math.abs(Δy) + Math.abs(Δz)
Threshold:    0.08
Grace period: 5 seconds of movement before penalty fires
Web fallback: always isStill = true
```

Warning state activates immediately when delta > 0.08. If device stills within 5s, warning resets. If 5s elapses, penalty fires.

---

## 11. Sound Effects

Three audio files in `assets/sounds/`:
- `success.mp3` — played on session complete
- `warning.mp3` — played when a penalty is applied
- `end.mp3` — played when session is manually ended or auto-ended

Loading: `Audio.Sound.createAsync(source, { shouldPlay: true })`. Sound unloaded automatically on `didJustFinish`. Toggle stored in AsyncStorage as `intent.soundEffects.v1`.

---

## 12. Font Loading

Root layout blocks rendering until fonts are ready:
```ts
const [fontsLoaded] = useFonts(fontAssets);
if (!fontsLoaded) return null;
```

Loaded subsets (from full Geist family):
- Geist: Regular, Medium, Bold, Black
- GeistMono: Regular, Medium, Bold

---

## 13. Known Issues & Production Flags

| Item | Location | Severity |
|---|---|---|
| `TEST_MODE = true` — sessions run 10s | `timer.tsx:23` | **Critical** — must flip before release |
| `console.log` debug statements | `manage-data.tsx:97, 113` | Minor — remove before release |
| `applyFailure()` exported but never called | `storage.ts:466` | Logic gap — streak doesn't reset on failure in current UI |
| `components/intent/theme.ts` has different color values than `constants/theme.ts` | Both files | Design inconsistency — two slightly different ink/muted/sage values |
| Friends system uses fully mock stats (no backend) | `storage.ts:124` | By design — noted as prototype |
| QR invite placeholder | `AccountScreen.tsx:159` | Future feature |
| `explore.tsx` and `settings.tsx` are hidden tab stubs | `(tabs)/` | Unused |
| `HomeScreen.tsx` exists in `components/` but is never imported | `components/HomeScreen.tsx` | Dead code |
| No automated tests | Whole project | By design (per CLAUDE.md) |

---

## 14. Summary of Data Flow

```
User picks duration + purpose + note (SessionScreen)
    ↓
Confirm modal preview (reward points calculated live)
    ↓
router.push('/timer', { sessionId, durationSeconds, rewardPoints, purpose, note })
    ↓
TimerScreen initializes (or restores from AsyncStorage)
    ↓
Accelerometer + 1s countdown interval running
    ↓
[Movement detected] → 5s grace → penalty (+15% time) or warning resets
    ↓
[5 penalties] → endSessionWithPartialReward('penalties')
[Manual quit]  → endSessionWithPartialReward('manual')
[Timer hits 0] → completeSuccess()
    ↓
recordSession() + applySuccess()|applyPartialReward() + clearActiveSession()
    ↓
Results screen shown (success/ended UI) → router.replace('/')
```

---

## 15. Future Ideas (from README)

- Ambient soundscapes
- Focus statistics visualization
- Physical device companion concept
- Haptic rhythm system
- OLED-inspired display modes
- Adaptive lighting themes
- QR-based friend invites (placeholder exists)
- Real friend backend (currently 100% local mock)
