---
name: new-component
description: Scaffold a new Intent UI component following the ceramic hardware-depth aesthetic (gradient bevel, recessed cavity, theme tokens, no border strokes). Usage: /new-component <ComponentName> <description>
disable-model-invocation: true
---

Create a new component at `components/intent/<ComponentName>.tsx` following the Intent design system rules:

## Ceramic depth effect (required for any surface/button/field)

Stack these layers in order:
1. **Outer shell** — `LinearGradient` from `expo-linear-gradient` with a subtle bevel tint
2. **Contact gap inset** — semi-transparent dark `View` with a small shadow
3. **Cavity shadow** — thin dark `View` simulating inner-shadow
4. **Inner field** — `#E4E0D8` surface with top-shade and bottom-highlight gradients overlaid using `pointerEvents="none"`

Never use hard border strokes. All depth comes from gradient and shadow layering only.

## Theme tokens (always import from constants/theme.ts)

- Colors: `colors.background` (`#F0EEE9`), `colors.ink`, `colors.muted`, `colors.sage`, `colors.orange`, etc.
- Spacing: `spacing.xs/sm/md/lg/xl/xxl/screenPadding/panelPadding/cardGap/controlGap`
- Radius: `radius.panel/card/control/button/smallButton/pill/dial`
- Typography: `typography.screenTitle/panelLabel/valueLarge/cardTitle/body/meta/button/chip/instrumentLabel`
- Shadows: `shadows.panel/raisedControl/button/pressed/dial`

Never hardcode colors, spacing, font sizes, or border radii.

## Reuse existing primitives when applicable

- Interactive controls → `CeramicButton` (size: `large | largeCompact | medium | small`)
- Indicators → `HardwareLed` (props: `isOn`, `size`)
- Empty lists → `EmptyState`
- Duration/time formatting → `formatDuration`, `formatTargetTime` from `components/intent/format.ts`
- Fonts → import from `constants/fonts.ts` (`fonts.sansRegular`, `fonts.sansMedium`, `fonts.sansBold`, `fonts.sansBlack`, `fonts.monoRegular`, `fonts.monoMedium`)

## Output

1. Create `components/intent/<ComponentName>.tsx` with the component
2. Export it as a named export
3. Tell the user which props it accepts and how to use it
