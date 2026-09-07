import XCTest
@testable import PolyFit

@MainActor
final class PolyFitCoreTests: XCTestCase {
    func testWebParityShapeCatalogAndColors() {
        XCTAssertEqual(ShapeName.allCases.count, 13)
        XCTAssertEqual(ShapeLibrary.colors.count, 8)
        XCTAssertEqual(ShapeLibrary.shapes[.square]?.cells.count, 4)
        XCTAssertEqual(ShapeLibrary.shapes[.yShape]?.cells.count, 5)
        XCTAssertEqual(ShapeLibrary.signature(ShapeLibrary.transformed(ShapeLibrary.shapes[.lShape]!, rotation: 4, flipped: false)),
                       ShapeLibrary.signature(ShapeLibrary.shapes[.lShape]!))
    }

    func testIrregularBoardMasksMatchWebCatalog() {
        XCTAssertEqual(IrregularBoard.allCases.count, 7)
        XCTAssertEqual(IrregularBoard.lShape.cutouts.count, 6)
        XCTAssertEqual(IrregularBoard.tShape.cutouts.count, 4)
        XCTAssertEqual(IrregularBoard.cross.cutouts.count, 16)
        XCTAssertEqual(IrregularBoard.uShape.cutouts.count, 2)
        XCTAssertEqual(IrregularBoard.hShape.cutouts.count, 12)
        XCTAssertEqual(IrregularBoard.cShape.cutouts.count, 11)
        XCTAssertEqual(IrregularBoard.plusShape.cutouts.count, 4)
    }

    func testDifficultyMilestones() {
        var random = SeededGenerator(seed: 42)
        XCTAssertEqual(Difficulty.parameters(level: 1, random: &random).numPieces, 3)
        XCTAssertEqual(Difficulty.parameters(level: 15, random: &random).numPieces, 4)
        XCTAssertEqual(Difficulty.parameters(level: 50, random: &random).numPieces, 5)
        XCTAssertEqual(Difficulty.parameters(level: 125, random: &random).numPieces, 6)
        XCTAssertEqual(Difficulty.parameters(level: 200, random: &random).numPieces, 7)
        XCTAssertEqual(Difficulty.logProbability(level: 74, intro: 75, maximum: 1, scale: 50), 0)
    }

    func testSeededGeneratorProducesSolvableFixture() throws {
        let puzzle = try PuzzleGenerator().generate(level: 1, seed: 0x504F4C59464954)
        XCTAssertEqual(puzzle.pieces.count, 3)
        XCTAssertEqual(puzzle.targetGrid.flatMap { $0 }.filter { $0 == 1 }.count,
                       puzzle.pieces.reduce(0) { $0 + $1.shape.cells.count })
        XCTAssertGreaterThan(PuzzleSolver().countSolutions(puzzle, limit: 1), 0)
    }

    func testSolverFindsAKnownTiling() {
        let domino = ShapeLibrary.shapes[.domino]!
        let pieces = (0..<2).map { index in
            PieceState(id: index, shapeName: .domino, originalShape: domino, colorHex: "#fff",
                       shape: domino, x: 0, y: 0, rotation: 0, flipped: false,
                       solutionX: 0, solutionY: index, solutionRotation: 0, solutionFlipped: false,
                       startRotation: 0, startFlipped: false, effectiveRotation: 0, effectiveFlipped: false)
        }
        let puzzle = Puzzle(targetGrid: [[1, 1], [1, 1]], boardRows: 2, boardCols: 2, pieces: pieces, level: 1)
        XCTAssertGreaterThanOrEqual(PuzzleSolver().countSolutions(puzzle, limit: 10), 1)
    }

    func testSolverCancellationAndGenerationRace() async throws {
        let generator = PuzzleGenerator()
        let puzzle = try generator.generate(level: 1, seed: 7)
        let task = Task { try await PuzzleSolver().countSolutionsAsync(puzzle, limit: 10_000) }
        task.cancel()
        do {
            _ = try await task.value
            XCTFail("Cancelled solver should not complete successfully")
        } catch is CancellationError {
            XCTAssertTrue(true)
        }

        let state = GameState(generator: generator, store: ProgressStore(defaults: UserDefaults(suiteName: "PolyFitCoreTests")!))
        state.startLevel(1, seed: 1)
        state.startLevel(1, seed: 2)
        try await Task.sleep(for: .milliseconds(100))
        XCTAssertTrue(state.isGenerating == false || state.puzzle?.level == 1)
    }

    func testCheatCodeRequiresFiveTitleTaps() {
        let detector = CheatCodeDetector()
        for tapIndex in 0..<4 { XCTAssertFalse(detector.tap("TITLE", now: Date(timeIntervalSince1970: Double(tapIndex) * 0.1))) }
        XCTAssertTrue(detector.tap("TITLE", now: Date(timeIntervalSince1970: 0.4)))
        XCTAssertFalse(detector.tap("LEVEL"))
    }

    func testProgressPersistsWithoutWebStorage() {
        let suite = UserDefaults(suiteName: "PolyFitProgressTests")!
        suite.removePersistentDomain(forName: "PolyFitProgressTests")
        let store = ProgressStore(defaults: suite)
        var progress = Progress()
        progress.maxLevel = 9
        progress.theme = .magenta
        XCTAssertTrue(store.save(progress))
        XCTAssertEqual(store.load(), progress)
    }
}
