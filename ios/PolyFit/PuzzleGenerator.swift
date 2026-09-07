import Foundation

public enum PuzzleGenerationError: Error, Sendable {
    case exhaustedRetries
}

public struct PuzzleGenerator: Sendable {
    public let solver: PuzzleSolver

    public init(solver: PuzzleSolver = PuzzleSolver()) {
        self.solver = solver
    }

    public func generate(level: Int, seed: UInt64) throws -> Puzzle {
        var random = SeededGenerator(seed: seed)
        let parameters = Difficulty.parameters(level: level, random: &random)
        return try generate(level: level, parameters: parameters, random: &random)
    }

    public func generate(level: Int, parameters: DifficultyParams,
                        random: inout SeededGenerator) throws -> Puzzle {
        let shapeNames = selectShapeNames(count: parameters.numPieces,
                                          bias: parameters.asymmetricBias,
                                          random: &random)
        let retryLimit = 2_000

        for _ in 0..<retryLimit {
            var grid = Array(repeating: Array(repeating: 0, count: parameters.boardCols), count: parameters.boardRows)
            if let irregular = parameters.irregularShape {
                for cutout in irregular.cutouts { grid[cutout.row][cutout.column] = -2 }
            }

            var pieces: [PieceState] = []
            var failed = false
            for (pieceIndex, shapeName) in shapeNames.enumerated() {
                let baseShape = ShapeLibrary.shapes[shapeName]!
                var orientations = ShapeLibrary.orientations(of: baseShape)
                shuffle(&orientations, random: &random)
                var placed = false

                for orientation in orientations {
                    var placements = findPlacements(grid: grid, shape: orientation, requireAdjacent: pieceIndex > 0)
                    shuffle(&placements, random: &random)
                    guard let placement = placements.first else { continue }
                    mark(grid: &grid, shape: orientation, column: placement.column, row: placement.row, value: 1)
                    let transform = transform(from: baseShape, to: orientation)
                    pieces.append(PieceState(
                        id: pieceIndex, shapeName: shapeName, originalShape: baseShape,
                        colorHex: ShapeLibrary.colors[pieceIndex % ShapeLibrary.colors.count], shape: orientation,
                        x: 0, y: 0, rotation: 0, flipped: false,
                        solutionX: placement.column, solutionY: placement.row,
                        solutionRotation: transform.rotation, solutionFlipped: transform.flipped,
                        startRotation: 0, startFlipped: false,
                        effectiveRotation: 0, effectiveFlipped: false
                    ))
                    placed = true
                    break
                }
                if !placed { failed = true; break }
            }
            if failed { continue }

            let occupied = Set(pieces.flatMap { piece in
                piece.shape.cells.map { Cell(column: piece.solutionX + $0.column, row: piece.solutionY + $0.row) }
            })
            addHoles(to: &grid, count: parameters.numHoles, occupied: occupied, random: &random)

            let puzzlePieces = pieces.map { piece in
                let startRotation = random.integer(upperBound: 4)
                let startFlipped = random.unit() < 0.5
                let startShape = ShapeLibrary.transformed(piece.originalShape, rotation: startRotation, flipped: startFlipped)
                let solutionShape = ShapeLibrary.transformed(piece.originalShape, rotation: piece.solutionRotation, flipped: piece.solutionFlipped)
                let effective = transform(from: startShape, to: solutionShape)
                return PieceState(
                    id: piece.id, shapeName: piece.shapeName, originalShape: piece.originalShape,
                    colorHex: piece.colorHex, shape: startShape,
                    x: 0, y: 0, rotation: 0, flipped: false,
                    solutionX: piece.solutionX, solutionY: piece.solutionY,
                    solutionRotation: piece.solutionRotation, solutionFlipped: piece.solutionFlipped,
                    startRotation: startRotation, startFlipped: startFlipped,
                    effectiveRotation: effective.rotation, effectiveFlipped: effective.flipped
                )
            }
            let puzzle = Puzzle(targetGrid: grid, boardRows: parameters.boardRows,
                                boardCols: parameters.boardCols, pieces: puzzlePieces, level: level)
            if solver.countSolutions(puzzle, limit: 1) > 0 { return puzzle }
        }
        throw PuzzleGenerationError.exhaustedRetries
    }

    private func selectShapeNames(count: Int, bias: Double, random: inout SeededGenerator) -> [ShapeName] {
        let easy: [ShapeName] = [.domino, .line3, .square, .line4]
        let medium: [ShapeName] = [.corner3, .tShape, .lShape]
        let hard: [ShapeName] = [.sShape, .pShape, .l5Shape, .wShape, .yShape, .cShape]
        var available = Set(ShapeName.allCases)
        var selected: [ShapeName] = []
        for _ in 0..<count {
            let roll = random.unit()
            let preferred: [ShapeName]
            if roll < bias { preferred = hard }
            else if roll < bias + 0.3 { preferred = medium }
            else { preferred = easy }
            let candidates = preferred.filter { available.contains($0) }
            let fallback = Array(available)
            let pool = candidates.isEmpty ? fallback : candidates
            guard !pool.isEmpty else { break }
            let shape = pool[random.integer(upperBound: pool.count)]
            selected.append(shape)
            available.remove(shape)
        }
        while selected.count < count {
            selected.append(ShapeName.allCases[selected.count % ShapeName.allCases.count])
        }
        return selected
    }

    private func findPlacements(grid: [[Int]], shape: PolyShape, requireAdjacent: Bool) -> [Cell] {
        guard let firstRow = grid.first else { return [] }
        var result: [Cell] = []
        for row in grid.indices {
            for column in firstRow.indices {
                if canPlace(grid: grid, shape: shape, column: column, row: row) &&
                    (!requireAdjacent || touchesExisting(grid: grid, shape: shape, column: column, row: row)) {
                    result.append(Cell(column: column, row: row))
                }
            }
        }
        return result
    }

    private func canPlace(grid: [[Int]], shape: PolyShape, column: Int, row: Int) -> Bool {
        for cell in shape.cells {
            let targetColumn = column + cell.column
            let targetRow = row + cell.row
            guard targetRow >= 0, targetRow < grid.count, targetColumn >= 0,
                  targetColumn < grid[targetRow].count, grid[targetRow][targetColumn] == 0 else { return false }
        }
        return true
    }

    private func touchesExisting(grid: [[Int]], shape: PolyShape, column: Int, row: Int) -> Bool {
        let offsets = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        for cell in shape.cells {
            for offset in offsets {
                let targetColumn = column + cell.column + offset.0
                let targetRow = row + cell.row + offset.1
                if targetRow >= 0, targetRow < grid.count, targetColumn >= 0,
                   targetColumn < grid[targetRow].count, grid[targetRow][targetColumn] == 1 { return true }
            }
        }
        return false
    }

    private func mark(grid: inout [[Int]], shape: PolyShape, column: Int, row: Int, value: Int) {
        for cell in shape.cells { grid[row + cell.row][column + cell.column] = value }
    }

    private func addHoles(to grid: inout [[Int]], count: Int, occupied: Set<Cell>, random: inout SeededGenerator) {
        guard count > 0, grid.count > 2, (grid.first?.count ?? 0) > 2 else { return }
        let candidates = grid.indices.dropFirst().dropLast().flatMap { row in
            grid[row].indices.dropFirst().dropLast().compactMap { column -> Cell? in
                let cell = Cell(column: column, row: row)
                return grid[row][column] == 0 && !occupied.contains(cell) ? cell : nil
            }
        }
        var shuffled = Array(candidates)
        shuffle(&shuffled, random: &random)
        for cell in shuffled.prefix(count) { grid[cell.row][cell.column] = -1 }
    }

    private func transform(from source: PolyShape, to target: PolyShape) -> (rotation: Int, flipped: Bool) {
        for flipped in [false, true] {
            for rotation in 0..<4 where ShapeLibrary.signature(ShapeLibrary.transformed(source, rotation: rotation, flipped: flipped)) == ShapeLibrary.signature(target) {
                return (rotation, flipped)
            }
        }
        return (0, false)
    }

    private func shuffle<T>(_ values: inout [T], random: inout SeededGenerator) {
        guard values.count > 1 else { return }
        for index in stride(from: values.count - 1, through: 1, by: -1) {
            let swapIndex = random.integer(upperBound: index + 1)
            values.swapAt(index, swapIndex)
        }
    }
}
