# PolyFit - Neon Puzzle Game

A mobile-friendly, procedurally generated puzzle game inspired by Ubongo, built with **Vanilla JS** and **Canvas API**.

## 🚀 How to Run

Because this project uses ES Modules (`import/export`), you cannot open `index.html` directly from the file system due to browser security restrictions (CORS). You need a local server.

### Quick Start (Node.js)
```bash
npx serve .
```
Then open http://localhost:3000

Alternatively with Python:
```bash
python3 -m http.server
```

## 🎮 How to Play
1.  **Goal**: Fit all the neon pieces into the glowing target shape (the pits).
2.  **Move**: Drag pieces. On mobile, the piece floats above your finger so you can see it.
3.  **Rotate**: Tap a piece to rotate it 90 degrees.
4.  **Flip**: Select a piece (move it) then tap the "Mirror" button in the corner to flip it.

## 🛠️ Technical Details
-   **TDD**: Core logic (`shapes`, `puzzle`, `game.js`) was built using Test Driven Development with **Vitest**.
-   **Canvas Renderer**: Custom 2D renderer supporting dynamic resizing and neon glow effects.
-   **Algorithm**: "Reverse Construction" puzzle generation guarantees every level is solvable.
-   **No Dependencies**: The runtime game has 0 dependencies. `vitest` is only used for dev/testing.

## 📁 Structure
-   `js/`
    -   `shapes.js`: Geometry definitions and transformations (Rotate/Flip).
    -   `puzzle.js`: Procedural generation logic.
    -   `game.js`: State management and Win Condition logic.
    -   `renderer.js`: Visual layer (Canvas).
    -   `input.js`: Touch/Mouse unification.
    -   `main.js`: Bootstrapper.
-   `css/`: Glassmorphism styles.
-   `tests/`: Unit tests.
