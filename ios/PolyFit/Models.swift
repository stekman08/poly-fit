import Foundation

public struct Cell: Hashable, Codable, Sendable {
    public let column: Int
    public let row: Int

    public init(column: Int, row: Int) {
        self.column = column
        self.row = row
    }
}

public struct PolyShape: Hashable, Codable, Sendable {
    public let cells: [Cell]

    public init(_ cells: [Cell]) {
        self.cells = cells
    }

    public var width: Int { (cells.map(\.column).max() ?? -1) + 1 }
    public var height: Int { (cells.map(\.row).max() ?? -1) + 1 }
}

public enum ShapeName: String, CaseIterable, Codable, Sendable {
    case domino = "Domino"
    case line3 = "Line3"
    case corner3 = "Corner3"
    case tShape = "T"
    case lShape = "L"
    case sShape = "S"
    case square = "Square"
    case line4 = "Line4"
    case cShape = "C"
    case pShape = "P"
    case l5Shape = "L5"
    case wShape = "W"
    case yShape = "Y"
}

public struct PieceState: Identifiable, Hashable, Codable, Sendable {
    public let id: Int
    public let shapeName: ShapeName
    public let originalShape: PolyShape
    public let colorHex: String
    public var shape: PolyShape
    public var x: Int
    public var y: Int
    public var rotation: Int
    public var flipped: Bool
    public let solutionX: Int
    public let solutionY: Int
    public let solutionRotation: Int
    public let solutionFlipped: Bool
    public let startRotation: Int
    public let startFlipped: Bool
    public let effectiveRotation: Int
    public let effectiveFlipped: Bool

    public init(id: Int, shapeName: ShapeName, originalShape: PolyShape, colorHex: String,
                shape: PolyShape, x: Int, y: Int, rotation: Int, flipped: Bool,
                solutionX: Int, solutionY: Int, solutionRotation: Int,
                solutionFlipped: Bool, startRotation: Int, startFlipped: Bool,
                effectiveRotation: Int, effectiveFlipped: Bool) {
        self.id = id
        self.shapeName = shapeName
        self.originalShape = originalShape
        self.colorHex = colorHex
        self.shape = shape
        self.x = x
        self.y = y
        self.rotation = rotation
        self.flipped = flipped
        self.solutionX = solutionX
        self.solutionY = solutionY
        self.solutionRotation = solutionRotation
        self.solutionFlipped = solutionFlipped
        self.startRotation = startRotation
        self.startFlipped = startFlipped
        self.effectiveRotation = effectiveRotation
        self.effectiveFlipped = effectiveFlipped
    }

    public var isInSolution: Bool {
        x == solutionX && y == solutionY && rotation == effectiveRotation && flipped == effectiveFlipped
    }
}

public struct Puzzle: Hashable, Codable, Sendable {
    public let targetGrid: [[Int]]
    public let boardRows: Int
    public let boardCols: Int
    public var pieces: [PieceState]
    public let level: Int

    public init(targetGrid: [[Int]], boardRows: Int, boardCols: Int, pieces: [PieceState], level: Int) {
        self.targetGrid = targetGrid
        self.boardRows = boardRows
        self.boardCols = boardCols
        self.pieces = pieces
        self.level = level
    }
}

public struct DifficultyParams: Hashable, Codable, Sendable {
    public let numPieces: Int
    public let boardRows: Int
    public let boardCols: Int
    public let numHoles: Int
    public let asymmetricBias: Double
    public let irregularShape: IrregularBoard?

    public init(numPieces: Int, boardRows: Int, boardCols: Int, numHoles: Int,
                asymmetricBias: Double, irregularShape: IrregularBoard?) {
        self.numPieces = numPieces
        self.boardRows = boardRows
        self.boardCols = boardCols
        self.numHoles = numHoles
        self.asymmetricBias = asymmetricBias
        self.irregularShape = irregularShape
    }
}

public enum IrregularBoard: String, CaseIterable, Codable, Sendable {
    case lShape, tShape, cross, uShape, hShape, cShape, plusShape

    public var dimensions: (rows: Int, cols: Int) {
        switch self {
        case .cross: return (6, 6)
        case .uShape: return (4, 5)
        default: return (5, 5)
        }
    }

    public var cutouts: Set<Cell> {
        switch self {
        case .lShape:
            return Set([Cell(column: 2, row: 0), Cell(column: 3, row: 0), Cell(column: 4, row: 0), Cell(column: 2, row: 1), Cell(column: 3, row: 1), Cell(column: 4, row: 1)])
        case .tShape:
            return Set([Cell(column: 0, row: 3), Cell(column: 4, row: 3), Cell(column: 0, row: 4), Cell(column: 4, row: 4)])
        case .cross:
            return Set((0..<6).flatMap { row in (0..<6).compactMap { column in
                ((column < 2 || column > 3) && (row < 2 || row > 3)) ? Cell(column: column, row: row) : nil
            }})
        case .uShape:
            return Set([Cell(column: 2, row: 0), Cell(column: 2, row: 1)])
        case .hShape:
            return Set((0..<5).flatMap { row in
                ((row < 2 || row > 2) ? (1..<4).map { Cell(column: $0, row: row) } : [])
            })
        case .cShape:
            return Set([Cell(column: 0, row: 0), Cell(column: 2, row: 1), Cell(column: 3, row: 1), Cell(column: 4, row: 1), Cell(column: 2, row: 2), Cell(column: 3, row: 2), Cell(column: 4, row: 2), Cell(column: 2, row: 3), Cell(column: 3, row: 3), Cell(column: 4, row: 3), Cell(column: 0, row: 4)])
        case .plusShape:
            return Set([Cell(column: 0, row: 0), Cell(column: 4, row: 0), Cell(column: 0, row: 4), Cell(column: 4, row: 4)])
        }
    }
}

public enum ThemeName: String, CaseIterable, Codable, Sendable {
    case cyan, magenta, green, orange
}

public struct Theme: Hashable, Codable, Sendable {
    public let name: ThemeName
    public let primary: String
    public let secondary: String
}

public struct Progress: Codable, Equatable, Sendable {
    public var maxLevel: Int = 1
    public var theme: ThemeName = .cyan
    public var tutorialShows: Int = 0
    public var soundEnabled: Bool = true
    public var hapticsEnabled: Bool = true
    public var reduceMotion: Bool = false
}
