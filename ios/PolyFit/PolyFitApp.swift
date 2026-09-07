import SwiftUI

@main
struct PolyFitApp: App {
    @StateObject private var game = GameState()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(game: game)
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active: game.appDidBecomeActive()
                    case .background, .inactive: game.appWillResignActive()
                    @unknown default: break
                    }
                }
        }
    }
}
