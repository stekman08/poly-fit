import Foundation

public enum SolverError: Error, Sendable {
    case cancelled
}

public struct PuzzleSolver: Sendable {
    public init() {}

    public func countSolutions(_ puzzle: Puzzle, limit: Int = 10) -> Int {
        countSolutions(targetGrid: puzzle.targetGrid, pieces: puzzle.pieces, limit: limit)
    }

    public func countSolutions(targetGrid: [[Int]], pieces: [PieceState], limit: Int = 10) -> Int {
        guard limit > 0, !targetGrid.isEmpty, let firstRow = targetGrid.first, !firstRow.isEmpty else { return 0 }
        var occupied = Array(repeating: Array(repeating: false, count: firstRow.count), count: targetGrid.count)
        let orientations = pieces.map { ShapeLibrary.orientations(of: $0.originalShape) }
        return solve(targetGrid: targetGrid, orientations: orientations, occupied: &occupied,
                     usedPieces: [], limit: limit, found: 0)
    }

    public func countSolutionsAsync(_ puzzle: Puzzle, limit: Int = 10) async throws -> Int {
        try await countAsync(targetGrid: puzzle.targetGrid,
                             orientations: puzzle.pieces.map { ShapeLibrary.orientations(of: $0.originalShape) },
                             limit: limit)
    }

    private func solve(targetGrid: [[Int]], orientations: [[PolyShape]], occupied: inout [[Bool]],
                       usedPieces: [Bool], limit: Int, found: Int) -> Int {
        if found >= limit { return found }
        guard let emptyCell = firstEmpty(targetGrid: targetGrid, occupied: occupied) else { return found + 1 }
        var solutionCount = found
        var mutableUsed = usedPieces.isEmpty ? Array(repeating: false, count: orientations.count) : usedPieces

        for pieceIndex in orientations.indices where !mutableUsed[pieceIndex] {
            for orientation in orientations[pieceIndex] {
                for shapeCell in orientation.cells {
                    let startColumn = emptyCell.column - shapeCell.column
                    let startRow = emptyCell.row - shapeCell.row
                    guard canPlace(targetGrid: targetGrid, occupied: occupied, shape: orientation,
                                   startColumn: startColumn, startRow: startRow) else { continue }
                    place(occupied: &occupied, shape: orientation, startColumn: startColumn, startRow: startRow, value: true)
                    mutableUsed[pieceIndex] = true
                    solutionCount = solve(targetGrid: targetGrid, orientations: orientations, occupied: &occupied,
                                          usedPieces: mutableUsed, limit: limit, found: solutionCount)
                    mutableUsed[pieceIndex] = false
                    place(occupied: &occupied, shape: orientation, startColumn: startColumn, startRow: startRow, value: false)
                    if solutionCount >= limit { return solutionCount }
                }
            }
        }
        return solutionCount
    }

    private func countAsync(targetGrid: [[Int]], orientations: [[PolyShape]], limit: Int) async throws -> Int {
        var occupied = Array(repeating: Array(repeating: false, count: targetGrid.first?.count ?? 0), count: targetGrid.count)
        return try await solveAsync(targetGrid: targetGrid, orientations: orientations, occupied: &occupied,
                                    usedPieces: [], limit: limit, found: 0)
    }

    private func solveAsync(targetGrid: [[Int]], orientations: [[PolyShape]], occupied: inout [[Bool]],
                            usedPieces: [Bool], limit: Int, found: Int) async throws -> Int {
        try Task.checkCancellation()
        if found >= limit { return found }
        guard let emptyCell = firstEmpty(targetGrid: targetGrid, occupied: occupied) else { return found + 1 }
        var solutionCount = found
        var mutableUsed = usedPieces.isEmpty ? Array(repeating: false, count: orientations.count) : usedPieces

        for pieceIndex in orientations.indices where !mutableUsed[pieceIndex] {
            for orientation in orientations[pieceIndex] {
                for shapeCell in orientation.cells {
                    try Task.checkCancellation()
                    let startColumn = emptyCell.column - shapeCell.column
                    let startRow = emptyCell.row - shapeCell.row
                    guard canPlace(targetGrid: targetGrid, occupied: occupied, shape: orientation,
                                   startColumn: startColumn, startRow: startRow) else { continue }
                    place(occupied: &occupied, shape: orientation, startColumn: startColumn, startRow: startRow, value: true)
                    mutableUsed[pieceIndex] = true
                    solutionCount = try await solveAsync(targetGrid: targetGrid, orientations: orientations,
                                                         occupied: &occupied, usedPieces: mutableUsed,
                                                         limit: limit, found: solutionCount)
                    mutableUsed[pieceIndex] = false
                    place(occupied: &occupied, shape: orientation, startColumn: startColumn, startRow: startRow, value: false)
                    if solutionCount >= limit { return solutionCount }
                }
            }
        }
        return solutionCount
    }

    private func firstEmpty(targetGrid: [[Int]], occupied: [[Bool]]) -> Cell? {
        for rowIndex in targetGrid.indices {
            for columnIndex in targetGrid[rowIndex].indices where targetGrid[rowIndex][columnIndex] == 1 && !occupied[rowIndex][columnIndex] {
                return Cell(column: columnIndex, row: rowIndex)
            }
        }
        return nil
    }

    private func canPlace(targetGrid: [[Int]], occupied: [[Bool]], shape: PolyShape,
                          startColumn: Int, startRow: Int) -> Bool {
        for cell in shape.cells {
            let column = startColumn + cell.column
            let row = startRow + cell.row
            guard row >= 0, row < targetGrid.count, column >= 0, column < targetGrid[row].count,
                  targetGrid[row][column] == 1, !occupied[row][column] else { return false }
        }
        return true
    }

    private func place(occupied: inout [[Bool]], shape: PolyShape,
                       startColumn: Int, startRow: Int, value: Bool) {
        for cell in shape.cells {
            occupied[startRow + cell.row][startColumn + cell.column] = value
        }
    }
}
