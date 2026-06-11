# Anchor

Anchor is a tactile focus timer prototype that turns digital detox into a physical ritual.

It combines a hardware-inspired timer dial, motion feedback, LEDs, rewards, and a custom navigation system to encourage users to put their phone down and stay anchored.

Instead of using flat productivity UI patterns, the app treats focus sessions like interacting with a calm precision device.

The project combines:

- recessed ceramic interfaces
- tactile interaction design
- mechanical-inspired timers
- ambient lighting systems
- industrial typography
- behavioral focus mechanics

Built with Expo + React Native.

---

# Design Philosophy

Most productivity apps feel:

- flat
- notification-driven
- SaaS-like
- visually noisy

Anchor moves in the opposite direction.

The interface is inspired by:

- industrial hardware
- precision instruments
- tactile control surfaces
- recessed ceramic panels
- analog counters
- embedded LEDs
- Braun / Teenage Engineering / physical timer devices

The goal is to make focus feel intentional rather than gamified.

---

# Features

## Focus Session System

- Custom hour/minute wheel selector
- Real-time progress ring
- Motion-based focus monitoring
- Penalty system for device movement
- Success / partial / failed session states

## Hardware-Inspired UI

- Ceramic recessed surfaces
- Contact gap shadows
- Glass-like selector windows
- LED indicator system
- Mechanical-style reward counter
- SVG-based timer rendering

## Typography System

- Geist Sans
- Geist Mono
- Instrument-style labels
- Precision-focused visual hierarchy

## Interaction Design

- Tactile button press animations
- Mechanical digit transitions
- Subtle LED glow behavior
- Stable UI layout during timer state changes

---

# Tech Stack

- Expo
- React Native
- TypeScript
- expo-linear-gradient
- react-native-svg
- expo-font

---

# Project Structure

```txt
app/
components/
  intent/
  screens/
constants/
assets/
  fonts/
  sounds/
services/
```

Key reusable primitives:

```txt
CeramicButton
HardwareLed
SessionScreen
TimerScreen
```

---

# Design System Notes

The UI system is built around layered depth rather than visible borders.

Core concepts:

- recessed seating
- contact gaps
- ambient cavity shadows
- ceramic bevels
- inset lighting
- molded surfaces

Most components avoid hard strokes and instead use:

- gradients
- shadow layering
- inset overlays
- optical depth

---

# Current Status

The project is currently focused on:

- refining tactile interactions
- polishing hardware realism
- improving timer feedback systems
- strengthening the design system consistency

---

# Future Ideas

- Ambient soundscapes
- Focus statistics visualization
- Physical device companion concept
- Haptic rhythm system
- OLED-inspired display modes
- Adaptive lighting themes

---

# Running Locally

```bash
npm install
npx expo start
```

---

# Screenshots

_Add screenshots here later._

Example:

```md
![Anchor Hero](docs/screenshots/hero.png)
```

---

# Notes

This project is heavily design-system driven and intentionally experimental.

The focus is not only productivity, but the emotional feel of interacting with a calm physical object translated into software.
