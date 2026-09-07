import SwiftUI

struct RootView: View {
    @ObservedObject var game: GameState
    @State private var showTutorial = false

    private var accent: Color { Color(hex: game.currentTheme().primary) }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            switch game.screen {
            case .start: startView
            case .levelSelect: levelSelectView
            case .tutorial: tutorialView
            case .playing: playingView
            case .menu: menuView
            }
        }
        .tint(accent)
        .onAppear {
            if game.progress.tutorialShows < 3 { showTutorial = true }
        }
        .sheet(isPresented: $showTutorial) {
            TutorialView {
                showTutorial = false
                game.markTutorialShown()
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var startView: some View {
        VStack(spacing: 28) {
            Text("POLYFIT")
                .font(.system(size: 42, weight: .bold, design: .monospaced))
                .foregroundStyle(accent)
                .shadow(color: accent, radius: 14)
                .accessibilityAddTraits(.isHeader)
                .onTapGesture { game.titleTapped() }
            VStack(spacing: 14) {
                Button("New Game") { game.beginNewGame(); showTutorialIfNeeded() }
                    .buttonStyle(NeonButtonStyle(color: accent))
                if game.progress.maxLevel > 1 {
                    Button("Continue (Level \(game.progress.maxLevel))") { game.continueGame(); showTutorialIfNeeded() }
                        .buttonStyle(NeonButtonStyle(color: accent))
                    Button("Level Select") { game.showLevelSelect() }
                        .buttonStyle(NeonButtonStyle(color: accent))
                }
            }
            Text("Native iOS edition")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(28)
    }

    private var playingView: some View {
        Group {
            if game.isGenerating {
                ProgressView("Constructing puzzle...")
                    .tint(accent)
                    .accessibilityLabel("Generating puzzle")
            } else if let puzzle = game.puzzle {
                GameView(game: game, puzzle: puzzle, accent: accent)
            } else {
                ProgressView("Loading...")
            }
        }
    }

    private var levelSelectView: some View {
        VStack(spacing: 20) {
            Text("SELECT LEVEL")
                .font(.title2.bold())
                .foregroundStyle(accent)
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 64))], spacing: 12) {
                    ForEach(1...max(game.progress.maxLevel, 1), id: \.self) { selectedLevel in
                        Button("\(selectedLevel)") { game.chooseLevel(selectedLevel) }
                            .frame(minWidth: 54, minHeight: 54)
                            .background(accent.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(accent, lineWidth: 1))
                            .accessibilityLabel("Level \(selectedLevel)")
                    }
                }
                .padding()
            }
            Button("Back") { game.returnToStart() }
                .buttonStyle(NeonButtonStyle(color: accent))
        }
        .padding()
    }

    private var tutorialView: some View { TutorialView { game.returnToStart() } }

    private var menuView: some View {
        VStack(spacing: 18) {
            Text("PAUSED").font(.title.bold()).foregroundStyle(accent)
            Toggle("Sound", isOn: Binding(get: { game.progress.soundEnabled }, set: { game.updateSettings(soundEnabled: $0) }))
            Toggle("Haptics", isOn: Binding(get: { game.progress.hapticsEnabled }, set: { game.updateSettings(hapticsEnabled: $0) }))
            Toggle("Reduce Motion", isOn: Binding(get: { game.progress.reduceMotion }, set: { game.updateSettings(reduceMotion: $0) }))
            Button("Change Theme") { game.cycleTheme() }.buttonStyle(NeonButtonStyle(color: accent))
            Button("Level Select") { game.showLevelSelect() }.buttonStyle(NeonButtonStyle(color: accent))
            Button("Resume") { game.dismissMenu() }.buttonStyle(NeonButtonStyle(color: accent))
        }
        .padding(28)
        .accessibilityElement(children: .contain)
    }

    private func showTutorialIfNeeded() {
        if game.progress.tutorialShows < 3 { showTutorial = true }
    }
}

struct TutorialView: View {
    let done: () -> Void

    var body: some View {
        VStack(spacing: 22) {
            Text("HOW TO PLAY").font(.title.bold()).accessibilityAddTraits(.isHeader)
            Label("Drag to move pieces", systemImage: "hand.draw")
            Label("Tap to rotate", systemImage: "rotate.right")
            Label("Quick swipe to flip", systemImage: "arrow.left.and.right")
            Text("You can also use the accessible Place, Rotate, and Flip controls below the board.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("GOT IT", action: done)
                .buttonStyle(NeonButtonStyle(color: .cyan))
                .accessibilityHint("Dismisses the tutorial")
        }
        .padding(28)
    }
}

struct NeonButtonStyle: ButtonStyle {
    let color: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.monospaced())
            .foregroundStyle(color)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(color.opacity(configuration.isPressed ? 0.3 : 0.12), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(color, lineWidth: 1))
    }
}

extension Color {
    init(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var number: UInt64 = 0
        Scanner(string: value).scanHexInt64(&number)
        self.init(red: Double((number >> 16) & 0xff) / 255,
                  green: Double((number >> 8) & 0xff) / 255,
                  blue: Double(number & 0xff) / 255)
    }
}
