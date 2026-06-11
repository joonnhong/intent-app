# Anchor Rules

This document is the source of truth for future Anchor design and implementation decisions. Use it to keep product direction, UI polish, motion behavior, and code changes consistent across future Codex or AI-assisted edits.

## 1. Product Identity

**App name:** Anchor

**Concept:** Anchor is a tactile focus timer prototype that turns digital detox into a physical ritual. Users set an intention, place their phone down, and stay focused while the app rewards stillness and detects movement.

**Core feeling:**

- calm
- grounded
- tactile
- precise
- physical
- warm
- intentional

**Avoid:**

- generic productivity app
- playful gamified toy
- cold sci-fi interface
- meditation cliche
- neon cyber aesthetic

## 2. Design Language

Anchor should feel like a physical device, not a flat mobile app.

**Visual principles:**

- ceramic/off-white surfaces
- recessed panels
- bevels and contact shadows
- hardware LEDs
- timer dial / instrument language
- subtle glass overlays
- mechanical motion
- restrained color usage

**Avoid:**

- generic cards
- strong blue UI
- default mobile styling
- harsh pure black
- excessive gradients
- overly glossy app-icon styling

**Core palette:**

- background / ceramic: `#F0EEE9`
- app ink: `#111312`
- muted text: `#666B67`
- soft dark gray: `#2F3330`, `#4A4E4B`, `#5B605C`
- dark cavity: `#1A1715`, `#211D1A`
- active orange: `#FF6A3D`, `#FF8A3D`
- success green: `#3EAD02`, `#31B103`, `#4F7D70`
- alert red-orange: `#FF5A36`, `#C94A35`, `#B94732`

**Typography:**

- Geist for general UI.
- Geist Mono for numbers, timers, counters, and mechanical labels.
- Use uppercase labels with restrained letter spacing where appropriate.

## 3. Interaction Rules

Anchor should feel physical and intentional.

**Rules:**

- Pressed states should feel tactile, not flashy.
- LEDs indicate status, not decoration.
- Motion should feel damped and mechanical.
- Timer interactions should feel deliberate.
- Avoid bouncy/cartoon animation.
- Avoid excessive microinteractions.

**Bottom navigation:**

- Five tabs: Dashboard/Home, Recent, Session, Friends, Account.
- Session remains the center tab.
- Pushed button asset is temporary during `onPressIn` only.
- Selected route is indicated by an independent LED overlay.
- Pressed state and selected state must remain separate.

## 4. Timer / Session Rules

**TimerDial:**

- Primary visual focus of the Session experience.
- Uses a layered PNG base with dynamic overlays.
- Do not replace the PNG-layer architecture without strong reason.
- Dynamic overlays include LED, rolling counter, ticks, pointer, and glow.

**Session behavior:**

- User selects session duration.
- Active session rewards stillness.
- Phone movement can trigger warning, penalty, and failure behavior.
- `TEST_MODE` may be enabled during development for quick demo flows.

**Important:**

- Do not change session scoring or storage behavior unless explicitly requested.
- Do not reset user stats, history, streaks, or achievements during visual updates.

## 5. Motion Graph Rules

The motion graph should feel like a physical measuring instrument.

**Visual language:**

- recessed graph window
- horizontal waveform
- subtle glass cover
- thin metallic stylus/needle on the right
- waveform should visually connect to the stylus tip
- motion should affect waveform amplitude and stylus movement

**Avoid:**

- neon oscilloscope look
- chaotic waveform
- thick cartoon pointer
- overly scientific/lab interface

## 6. Branding Rules

**App name:** Anchor

**Preferred wordmark:** `ANCHOR`

**Brand tone:**

- grounded
- calm
- tactile
- premium
- focused

**Suggested taglines:**

- Hold your focus.
- A tactile focus timer.
- Put the phone down. Stay anchored.

**Logo:**

- Use the Anchor logo asset where appropriate.
- Do not stretch or distort the logo.
- Use the logo mainly on splash, start, account, or about screens.
- Do not overcrowd every tab with the full logo.

## 7. Implementation Rules

**General:**

- Be conservative with refactors.
- Prefer small focused changes.
- Do not redesign unrelated screens.
- Do not rename major folders unless explicitly requested.
- Do not change AsyncStorage keys unless absolutely necessary.
- Do not delete assets unless confirmed unused.
- Do not introduce backend/auth unless explicitly requested.

**Validation after changes:**

Always run:

```bash
npx.cmd tsc --noEmit
npx.cmd expo lint
```

For UI or routing changes, also verify:

```bash
npx.cmd expo start -c
```

If using `expo start -c` would leave a long-running server active, use an equivalent bundling check and clearly report that choice.

## 8. Prototype Status

This is currently a portfolio prototype.

**Current prototype priorities:**

- visual polish
- interaction clarity
- stable demo flow
- screenshot/video capture readiness
- README and case study documentation

**Not yet required:**

- real authentication
- backend sync
- production analytics
- real friends/social backend
- app store deployment

## 9. AI / Codex Editing Guidelines

When making future edits:

- Inspect existing files before changing.
- Preserve working behavior.
- Avoid broad refactors.
- Report uncertain dead code instead of deleting it.
- Summarize files changed.
- Summarize TypeScript and lint results.
- Keep Anchor's tactile hardware identity intact.
