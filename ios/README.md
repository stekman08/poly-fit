# PolyFit native iOS app

This directory is a standalone SwiftUI application. It does not import, bundle, execute, or fetch the web implementation. The web app remains rooted at the repository root and keeps its existing JavaScript/Vitest/Playwright build.

## Targets

- `PolyFit.xcodeproj`: native application target, iOS 17+.
- `PolyFitTests`: fixture, rule, generator, solver, cancellation/race, persistence, and cheat tests.
- `PolyFitUITests`: simulator UI smoke test covering launch, tutorial, and the accessible path.

## Parity map

| Web source of truth | Native implementation |
| --- | --- |
| `js/shapes.js` | `PolyFit/ShapeLibrary.swift`: 13 shapes, 8 colors, normalize/rotate/flip/orientations |
| `js/config/difficulty.js` | `PolyFit/Difficulty.swift`: piece milestones, board curves, seven masks, holes, asymmetric bias |
| `js/puzzle.js` | `PolyFit/PuzzleGenerator.swift`: seeded reverse construction, masks, holes, randomized starting orientation |
| `js/solver.js` | `PolyFit/Solver.swift`: orientation deduplication, first-empty-cell backtracking, solution limit, cancellation checks |
| `js/game.js` and `js/input-utils.js` | `PolyFit/GameState.swift` and `GameView.swift`: drag, snap, tap rotation, quick swipe flip, win validation, ghost/hint |
| `js/storage.js`, `js/theme-manager.js`, `js/cheat-code.js` | `ProgressStore.swift` and `GameState.swift`: Codable UserDefaults persistence, four themes, five-title-tap cheat |
| `js/haptics.js`, `js/sounds.js`, `js/effects/Confetti.js` | `PlatformFeedback.swift` and native SwiftUI confetti overlay |
| `index.html` tutorial/menu flow | `RootView.swift`: start, continue, level select, tutorial, menu/settings, Dynamic Type-friendly SwiftUI controls |

## Deliberate platform differences

- SwiftUI replaces DOM/CSS/Canvas; no `WKWebView`, JavaScript engine, web server, service worker, analytics, or network resource is used by the native target.
- `UserDefaults` replaces `localStorage` and is intentionally namespaced to native progress. It is local-only and available offline.
- UIKit `UIImpactFeedbackGenerator`/`UINotificationFeedbackGenerator` replace the browser Vibration API. AVFoundation-backed synthesized tones replace Web Audio.
- SwiftUI gestures replace Pointer/Touch DOM events. The accessible controls expose Place/Rotate/Flip buttons so a critical path does not require dragging.
- VoiceOver labels and SwiftUI system fonts replace the browser's ARIA/CSS accessibility surface. Reduce Motion controls confetti and completion transitions.

## Verification

From the repository root worktree:

```sh
xcodebuild -project ios/PolyFit.xcodeproj -scheme PolyFit \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath /tmp/polyfit-derived test \
  CODE_SIGNING_ALLOWED=NO
```

The simulator test command is automated. Physical iPhone installation, VoiceOver hardware behavior, audio/haptic feel, safe-area review, and release signing still require a connected device and Apple signing identity; they are release-readiness gates, not claims made by the simulator test.
