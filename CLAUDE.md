# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npx expo start       # start development server (opens Expo Go QR)
npx expo start --ios     # run on iOS simulator
npx expo start --android # run on Android emulator
expo lint            # run ESLint
```

There are no automated tests. Validation is done by running the app on device/simulator.

## Architecture

**Intent** is an Expo + React Native focus-timer app with a hardware-inspired UI aesthetic (ceramic surfaces, recessed panels, LED indicators, industrial typography).

### Routing

Uses `expo-router` (file-based). The entry point is `app/_layout.tsx` which sets up fonts, navigation theme, and a `Stack`. All real screens live under `app/(tabs)/`:

- `index` → Dashboard
- `session` → Session setup (duration wheel + confirm modal)
- `recent` → Session history
- `account` → Stats, achievements, friends/invite codes
- `timer` → Active countdown timer (hidden from tab bar, pushed via `router.push('/timer', { params })`)

The timer route is never reachable from the tab bar (`href: null`) — `SessionScreen` calls `router.push('/timer', { params: { sessionId, durationSeconds, rewardPoints, purpose?, note? } })` to start it.

### Screen ↔ Component split

Tab files are thin wrappers. The real logic lives in `components/screens/`:
- `SessionScreen.tsx` — duration wheel pickers, purpose chips, reward counter, confirm modal
- `DashboardScreen.tsx` — stats overview
- `RecentScreen.tsx` — session history list
- `AccountScreen.tsx` — invite codes, friends, achievements

`app/(tabs)/timer.tsx` is the exception — the timer screen is self-contained in the tab file (it has complex real-time state that doesn't benefit from splitting).

### Design system

All visual tokens live in `constants/theme.ts`:
- `colors` — palette (background `#F0EEE9`, ink, muted, sage, orange, etc.)
- `spacing` — named spacings (xs/sm/md/lg/xl/xxl/screenPadding/panelPadding/cardGap/controlGap)
- `radius` — named border radii (panel, card, control, button, smallButton, pill, dial)
- `typography` — named text styles (screenTitle, panelLabel, valueLarge, timerValue, cardTitle, body, meta, button, chip, instrumentLabel)
- `shadows` — named shadow presets (panel, raisedControl, button, pressed, dial)
- `Colors` — backwards-compat light/dark map for expo navigation theme

`components/intent/theme.ts` re-exports from `constants/theme` plus adds layout constants; prefer importing from `constants/theme` directly.

### Hardware depth effect pattern

The "ceramic/recessed" look is achieved by stacking multiple gradient and shadow layers. The standard pattern (seen in `CeramicButton`, wheel pickers, note field, reward digits) is:

1. Outer shell — `LinearGradient` with a subtle bevel tint
2. Contact gap inset — semi-transparent dark view with a small shadow
3. Cavity shadow — thin dark view simulating inner-shadow
4. Inner field — the actual content surface (`#E4E0D8`), with top-shade and bottom-highlight gradients overlaid using `pointerEvents="none"`

Never use hard border strokes on UI elements — use gradient and shadow layering instead.

### Reusable primitives

**`CeramicButton`** (`components/intent/CeramicButton.tsx`) — the standard button. Accepts `size` (`large` | `largeCompact` | `medium` | `small`), `surfaceStyle`, and `children`. Press animation via `Pressable` state callbacks. Use `surfaceStyle` to override the inner row (e.g., add padding or gap for chip layouts).

**`HardwareLed`** (`components/intent/HardwareLed.tsx`) — SVG LED indicator. Accepts `isOn` and `size`. Has a pulsing variant in the timer screen that reuses the same SVG structure with Animated.

**`EmptyState`** (`components/intent/EmptyState.tsx`) — empty-state placeholder for lists.

**`format.ts`** (`components/intent/format.ts`) — `formatDuration`, `formatTargetTime` utilities shared between session setup and history views.

### Persistence

All data is stored in AsyncStorage via `services/storage.ts`. Storage keys are versioned (`.v1` suffix). Key exports:

- `getStats` / `saveStats` / `applySuccess` / `applyPartialReward` / `applyFailure` — manage points and streak
- `getSessionHistory` / `saveSessionHistory` / `recordSession` — up to 50 records kept
- `calculateRewardPoints(durationMinutes)` — base points = `minutes * 2`, scaled by a multiplier that increases with duration (1x for <30min, up to 2.5x for ≥4h)
- `calculateAchievements(stats, history)` — derives achievement unlock state from history; no separate storage
- Friend system is local-only with mock stats seeded from invite code hash

### Timer mechanics

`app/(tabs)/timer.tsx` contains:
- **`TEST_MODE = true`** — while `true`, sessions run for `TEST_DURATION_SECONDS = 10` seconds instead of the selected duration. **Set to `false` before any production release.**
- Accelerometer monitoring via `expo-sensors` at 350ms intervals; movement delta threshold `0.08`
- 5-second grace period before a movement becomes a penalty (`MOVEMENT_WARNING_SECONDS`)
- Each penalty adds 15% of countdown duration to the end time
- After 5 penalties (`MAX_PENALTY_COUNT`), session ends automatically with partial reward (25% of earned points)
- Session state is persisted to AsyncStorage under `intent.activeSession.v1` so it survives backgrounding; restored on re-mount

### Fonts

Geist Sans and Geist Mono are loaded from `assets/fonts/`. Font family constants are in `constants/fonts.ts` (`fonts.sansRegular`, `fonts.sansMedium`, `fonts.sansBold`, `fonts.sansBlack`, `fonts.monoRegular`, `fonts.monoMedium`). The root layout blocks render until fonts are loaded.
