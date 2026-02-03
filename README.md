# PolyFit

A mobile-friendly, procedurally generated puzzle game inspired by Ubongo,
built with **Vanilla JS** and **Canvas API**.

## How to Play

1. **Goal**: Fit all the neon pieces into the glowing target shape
2. **Drag**: Move pieces around
3. **Tap**: Rotate a piece 90 degrees
4. **Quick Swipe**: Flip/mirror a piece

## Getting Started

```bash
bun install
bun run start
```

Then open <http://localhost:3000>

## Technical Details

- **TDD**: Core logic built using Test Driven Development with Vitest
- **Canvas Renderer**: Custom 2D renderer with dynamic resizing and neon glow
  effects
- **Algorithm**: "Reverse Construction" puzzle generation guarantees every level
  is solvable
- **PWA**: Installable as a home screen app with offline support
- **Zero Runtime Dependencies**: Only dev dependencies for testing
