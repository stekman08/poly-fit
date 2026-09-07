import Combine
import Foundation

public struct Hint: Equatable, Sendable {
    public let pieceID: Int
    public let column: Int
    public let row: Int
    public let shape: PolyShape
    public let colorHex: String
}

public enum GameScreen: Equatable, Sendable {
    case start
    case levelSelect
    case tutorial
    case playing
    case menu
}

public final class CheatCodeDetector {
    private let expectedLength = 5
    private var progress = 0
    private var lastTap: Date?
    private let resetInterval: TimeInterval

    public init(resetInterval: TimeInterval = 1.5) {
        self.resetInterval = resetInterval
    }

    @discardableResult
    public func tap(_ target: String, now: Date = Date()) -> Bool {
        if let lastTap, now.timeIntervalSince(lastTap) > resetInterval { progress = 0 }
        self.lastTap = now
        guard target == "TITLE" else { progress = 0; return false }
        progress = min(expectedLength, progress + 1)
        if progress == expectedLength { progress = 0; return true }
        return false
    }

    public var currentProgress: Int { progress }
}

@MainActor
public final class GameState: ObservableObject {
    @Published public private(set) var puzzle: Puzzle?
    @Published public private(set) var screen: GameScreen = .start
    @Published public private(set) var level: Int
    @Published public private(set) var progress: Progress
    @Published public private(set) var hint: Hint?
    @Published public private(set) var isGenerating = false
    @Published public private(set) var didWin = false
    @Published public private(set) var confettiToken = 0

    public let generator: PuzzleGenerator
    public let feedback: PlatformFeedback
    public let store: ProgressStore
    public let cheatCode = CheatCodeDetector()
    private var generationTask: Task<Void, Never>?
    private var generationSerial = 0

    public init(generator: PuzzleGenerator = PuzzleGenerator(),
                store: ProgressStore = ProgressStore(),
                feedback: PlatformFeedback = PlatformFeedback()) {
        self.generator = generator
        self.store = store
        self.feedback = feedback
        let loadedProgress = store.load()
        self.progress = loadedProgress
        self.level = loadedProgress.maxLevel
        feedback.soundEnabled = loadedProgress.soundEnabled
        feedback.hapticsEnabled = loadedProgress.hapticsEnabled
    }

    deinit { generationTask?.cancel() }

    public func beginNewGame() {
        level = 1
        screen = .playing
        startLevel(level)
    }

    public func continueGame() {
        level = max(1, progress.maxLevel)
        screen = .playing
        startLevel(level)
    }

    public func chooseLevel(_ selectedLevel: Int) {
        guard selectedLevel > 0, selectedLevel <= progress.maxLevel else { return }
        level = selectedLevel
        screen = .playing
        startLevel(level)
    }

    public func showLevelSelect() { screen = .levelSelect }
    public func showMenu() { screen = .menu }
    public func dismissMenu() { screen = .playing }
    public func returnToStart() { screen = .start }
    public func markTutorialShown() {
        progress.tutorialShows += 1
        store.save(progress)
    }

    public func startLevel(_ requestedLevel: Int, seed: UInt64? = nil) {
        generationTask?.cancel()
        generationSerial += 1
        let serial = generationSerial
        level = max(1, requestedLevel)
        isGenerating = true
        didWin = false
        hint = nil
        let generationSeed = seed ?? UInt64(level) &* 0x9E3779B97F4A7C15 &+ UInt64(serial)
        let generator = self.generator
        generationTask = Task { @MainActor [weak self] in
            do {
                let generatedPuzzle = try generator.generate(level: requestedLevel, seed: generationSeed)
                try Task.checkCancellation()
                guard let self, self.generationSerial == serial else { return }
                var loadedPuzzle = generatedPuzzle
                loadedPuzzle.pieces = self.layoutDock(loadedPuzzle.pieces, boardColumns: loadedPuzzle.boardCols, boardRows: loadedPuzzle.boardRows)
                self.puzzle = loadedPuzzle
                self.isGenerating = false
            } catch is CancellationError {
            } catch {
                guard let self, self.generationSerial == serial else { return }
                self.isGenerating = false
            }
        }
    }

    public func rotate(pieceID: Int) {
        updatePiece(pieceID) { piece in
            piece.rotation = (piece.rotation + 1) % 4
            piece.shape = currentShape(for: piece)
        }
        feedback.rotate()
        hideHint()
    }

    public func flip(pieceID: Int) {
        updatePiece(pieceID) { piece in
            piece.flipped.toggle()
            piece.shape = currentShape(for: piece)
        }
        feedback.flip()
        hideHint()
    }

    public func move(pieceID: Int, column: Int, row: Int) {
        updatePiece(pieceID) { piece in
            piece.x = max(0, min(column, (self.puzzle?.boardCols ?? 1) - piece.shape.width))
            piece.y = max(0, row)
        }
        hideHint()
    }

    public func snap(pieceID: Int, column: Int, row: Int) {
        move(pieceID: pieceID, column: column, row: row)
        feedback.snap()
        if checkWin() { finishLevel() }
    }

    public func placeAccessibly(pieceID: Int) {
        guard let puzzle, let currentPiece = puzzle.pieces.first(where: { $0.id == pieceID }) else { return }
        updatePiece(pieceID) { piece in
            piece.x = currentPiece.solutionX
            piece.y = currentPiece.solutionY
            piece.rotation = currentPiece.effectiveRotation
            piece.flipped = currentPiece.effectiveFlipped
            piece.shape = currentShape(for: piece)
        }
        if checkWin() { finishLevel() }
    }

    public func getHint() -> Hint? {
        guard let puzzle else { return nil }
        guard let piece = puzzle.pieces.first(where: { !$0.isInSolution }) else { return nil }
        let solutionShape = ShapeLibrary.transformed(piece.originalShape,
                                                     rotation: piece.solutionRotation,
                                                     flipped: piece.solutionFlipped)
        let result = Hint(pieceID: piece.id, column: piece.solutionX, row: piece.solutionY,
                          shape: solutionShape, colorHex: piece.colorHex)
        hint = result
        return result
    }

    public func hideHint() { hint = nil }

    public func advanceAfterWin() {
        guard didWin else { return }
        level += 1
        startLevel(level)
    }

    public func activateCheat() {
        _ = getHint()
        feedback.win()
    }

    public func titleTapped(at date: Date = Date()) {
        if cheatCode.tap("TITLE", now: date) { activateCheat() }
        else { feedback.rotate() }
    }

    public func updateSettings(soundEnabled: Bool? = nil, hapticsEnabled: Bool? = nil, reduceMotion: Bool? = nil) {
        if let soundEnabled { progress.soundEnabled = soundEnabled; feedback.soundEnabled = soundEnabled }
        if let hapticsEnabled { progress.hapticsEnabled = hapticsEnabled; feedback.hapticsEnabled = hapticsEnabled }
        if let reduceMotion { progress.reduceMotion = reduceMotion }
        store.save(progress)
    }

    public func cycleTheme() {
        let themes = ThemeName.allCases
        let currentIndex = themes.firstIndex(of: progress.theme) ?? 0
        progress.theme = themes[(currentIndex + 1) % themes.count]
        store.save(progress)
        feedback.rotate()
    }

    public func currentTheme() -> Theme {
        switch progress.theme {
        case .cyan: return Theme(name: .cyan, primary: "#00E5FF", secondary: "#00B8CC")
        case .magenta: return Theme(name: .magenta, primary: "#F92672", secondary: "#E02266")
        case .green: return Theme(name: .green, primary: "#A6E22E", secondary: "#8FD125")
        case .orange: return Theme(name: .orange, primary: "#FD971F", secondary: "#E0851A")
        }
    }

    public func appDidBecomeActive() {
        if screen == .playing, puzzle == nil { startLevel(level) }
        hideHint()
    }

    public func appWillResignActive() {
        if let puzzle { self.puzzle = puzzle }
    }

    public func checkWin() -> Bool {
        guard let puzzle, puzzle.pieces.allSatisfy({ $0.y < puzzle.boardRows }) else { return false }
        var occupied = Array(repeating: Array(repeating: 0, count: puzzle.boardCols), count: puzzle.boardRows)
        for piece in puzzle.pieces {
            for cell in piece.shape.cells {
                let column = piece.x + cell.column
                let row = piece.y + cell.row
                guard row >= 0, row < puzzle.boardRows, column >= 0, column < puzzle.boardCols else { return false }
                occupied[row][column] += 1
            }
        }
        for row in 0..<puzzle.boardRows {
            for column in 0..<puzzle.boardCols {
                let target = puzzle.targetGrid[row][column]
                let current = occupied[row][column]
                if current > 1 || (target == 1 && current != 1) || (target != 1 && current != 0) { return false }
            }
        }
        return true
    }

    private func finishLevel() {
        guard !didWin else { return }
        didWin = true
        confettiToken += 1
        feedback.win()
        if level >= progress.maxLevel { progress.maxLevel = level + 1; store.save(progress) }
    }

    private func currentShape(for piece: PieceState) -> PolyShape {
        let startShape = ShapeLibrary.transformed(piece.originalShape, rotation: piece.startRotation, flipped: piece.startFlipped)
        return ShapeLibrary.transformed(startShape, rotation: piece.rotation, flipped: piece.flipped)
    }

    private func updatePiece(_ pieceID: Int, update: (inout PieceState) -> Void) {
        guard var puzzle, let index = puzzle.pieces.firstIndex(where: { $0.id == pieceID }) else { return }
        update(&puzzle.pieces[index])
        self.puzzle = puzzle
    }

    private func layoutDock(_ pieces: [PieceState], boardColumns: Int, boardRows: Int) -> [PieceState] {
        var output = pieces
        var currentColumn = 0
        var currentRow = boardRows + 1
        var rowHeight = 0
        for index in output.indices {
            let pieceWidth = output[index].shape.width
            let pieceHeight = output[index].shape.height
            if currentColumn + pieceWidth > boardColumns {
                currentColumn = 0
                currentRow += rowHeight
                rowHeight = 0
            }
            output[index].x = currentColumn
            output[index].y = currentRow
            currentColumn += pieceWidth
            rowHeight = max(rowHeight, pieceHeight)
        }
        return output
    }
}
