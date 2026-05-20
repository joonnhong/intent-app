---
name: project-conventions
description: Intent app design and architectural conventions — ceramic depth effect, theme tokens, CeramicButton sizing, timer TEST_MODE flag, route push pattern for /timer, storage versioning, font constants
user-invocable: false
---

# Intent App Conventions

## Hardware depth effect pattern

The "ceramic/recessed" look is achieved by stacking multiple gradient and shadow layers. Standard pattern (used in CeramicButton, wheel pickers, note field, reward digits):

1. Outer shell — `LinearGradient` with a subtle bevel tint
2. Contact gap inset — semi-transparent dark view with a small shadow
3. Cavity shadow — thin dark view simulating inner-shadow
4. Inner field — the actual content surface (`#E4E0D8`), with top-shade and bottom-highlight gradients overlaid using `pointerEvents="none"`

**Never use hard border strokes.** All depth is from gradient and shadow layering.

## Reusable primitives

- **`CeramicButton`** (`components/intent/CeramicButton.tsx`) — standard button. Props: `size` (`large | largeCompact | medium | small`), `surfaceStyle`, `children`. Use `surfaceStyle` to override inner row layout.
- **`HardwareLed`** (`components/intent/HardwareLed.tsx`) — SVG LED indicator. Props: `isOn`, `size`.
- **`EmptyState`** (`components/intent/EmptyState.tsx`) — empty-state placeholder for lists.
- **`format.ts`** — `formatDuration`, `formatTargetTime` utilities.

## Design tokens (always from constants/theme.ts)

- `colors` — background `#F0EEE9`, ink, muted, sage, orange, etc.
- `spacing` — xs/sm/md/lg/xl/xxl/screenPadding/panelPadding/cardGap/controlGap
- `radius` — panel/card/control/button/smallButton/pill/dial
- `typography` — screenTitle/panelLabel/valueLarge/timerValue/cardTitle/body/meta/button/chip/instrumentLabel
- `shadows` — panel/raisedControl/button/pressed/dial
- `components/intent/theme.ts` re-exports these plus layout constants — prefer `constants/theme` directly.

## Routing

- Timer screen is pushed programmatically: `router.push('/timer', { params: { sessionId, durationSeconds, rewardPoints, purpose?, note? } })`
- It has `href: null` — never reachable from tab bar
- Tab files are thin wrappers; real logic lives in `components/screens/`
- Exception: `app/(tabs)/timer.tsx` is self-contained (complex real-time state)

## Timer mechanics (critical)

- **`TEST_MODE = true`** at top of `app/(tabs)/timer.tsx` — makes sessions run for 10 seconds. **Must be `false` before any production release.**
- Accelerometer via `expo-sensors` at 350ms, threshold `0.08`
- 5-second grace period (`MOVEMENT_WARNING_SECONDS`) before penalty
- Each penalty adds 15% of countdown duration
- After 5 penalties (`MAX_PENALTY_COUNT`) → session ends, 25% partial reward
- Session state persisted under `intent.activeSession.v1`

## Storage

- All via AsyncStorage in `services/storage.ts`
- Keys use `.v1` suffix (versioned)
- `recordSession` keeps max 50 records
- `calculateAchievements` is derived from history — no separate storage

## Fonts

Import from `constants/fonts.ts`:
`fonts.sansRegular`, `fonts.sansMedium`, `fonts.sansBold`, `fonts.sansBlack`, `fonts.monoRegular`, `fonts.monoMedium`
Root layout blocks render until fonts are loaded.
