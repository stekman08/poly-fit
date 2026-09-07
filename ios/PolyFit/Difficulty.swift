import Foundation

public struct SeededGenerator: RandomNumberGenerator, Sendable {
    private var state: UInt64

    public init(seed: UInt64) {
        state = seed == 0 ? 0x9E3779B97F4A7C15 : seed
    }

    public mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var value = state
        value = (value ^ (value >> 30)) &* 0xBF58476D1CE4E5B9
        value = (value ^ (value >> 27)) &* 0x94D049BB133111EB
        return value ^ (value >> 31)
    }

    public mutating func unit() -> Double {
        Double(next() >> 11) / Double(1 << 53)
    }

    public mutating func integer(upperBound: Int) -> Int {
        guard upperBound > 1 else { return 0 }
        return Int(next() % UInt64(upperBound))
    }
}

public enum Difficulty {
    private static let referenceLevel = 200.0

    public static func parameters(level: Int, random: inout SeededGenerator) -> DifficultyParams {
        let pieceCount: Int
        if level < 15 { pieceCount = 3 }
        else if level < 50 { pieceCount = 4 }
        else if level < 125 { pieceCount = 5 }
        else if level < 200 { pieceCount = 6 }
        else { pieceCount = 7 }

        var boardRows = 5
        var boardColumns = 5
        let shapeRoll = random.unit()
        if level >= 200 {
            (boardRows, boardColumns) = random.unit() < 0.5 ? (7, 6) : (6, 7)
        } else if level >= 125 {
            (boardRows, boardColumns) = random.unit() < 0.5 ? (6, 6) : (5, 7)
        } else if level >= 35 && level < 100 && shapeRoll < logProbability(level: level, intro: 35, maximum: 0.4, scale: 40) {
            (boardRows, boardColumns) = random.unit() < 0.5 ? (4, 6) : (6, 4)
        } else if level >= 100 {
            let extremeProbability = logProbability(level: level, intro: 100, maximum: 0.25, scale: 60)
            let wideProbability = logProbability(level: level, intro: 35, maximum: 0.4, scale: 40)
            if shapeRoll < extremeProbability {
                (boardRows, boardColumns) = random.unit() < 0.5 ? (3, 8) : (8, 3)
            } else if shapeRoll < extremeProbability + wideProbability {
                (boardRows, boardColumns) = random.unit() < 0.5 ? (4, 6) : (6, 4)
            }
        }

        var irregular: IrregularBoard?
        if level >= 60 && pieceCount <= 5 && random.unit() < 0.25 {
            let minimumCells = pieceCount * 4
            let candidates = IrregularBoard.allCases.filter { cells(for: $0) >= minimumCells }
            if !candidates.isEmpty {
                irregular = candidates[random.integer(upperBound: candidates.count)]
                (boardRows, boardColumns) = irregular!.dimensions
            }
        }

        var holes = 0
        if irregular == nil && level >= 75 {
            let holeRoll = random.unit()
            if level < 150 {
                if holeRoll < logProbability(level: level, intro: 75, maximum: 0.5, scale: 50) { holes = 1 }
            } else {
                let oneHole = logProbability(level: level, intro: 75, maximum: 0.5, scale: 50)
                let twoHoles = logProbability(level: level, intro: 150, maximum: 0.3, scale: 60)
                if holeRoll < twoHoles { holes = 2 }
                else if holeRoll < oneHole + twoHoles { holes = 1 }
            }
        }

        let bias: Double
        if level < 15 { bias = 0 }
        else if level < 175 { bias = logProbability(level: level, intro: 15, maximum: 0.5, scale: 80) }
        else { bias = min(1, 0.5 + logProbability(level: level, intro: 175, maximum: 0.4, scale: 50)) }

        return DifficultyParams(numPieces: pieceCount, boardRows: boardRows, boardCols: boardColumns,
                                numHoles: holes,
                                asymmetricBias: max(0, min(1, bias + (random.unit() - 0.5) * 0.2)),
                                irregularShape: irregular)
    }

    public static func logProbability(level: Int, intro: Int, maximum: Double, scale: Double) -> Double {
        guard level >= intro else { return 0 }
        let distance = Double(level - intro)
        return maximum * log(1 + distance / scale) / log(1 + referenceLevel / scale)
    }

    public static func cells(for board: IrregularBoard) -> Int {
        let dimensions = board.dimensions
        return dimensions.rows * dimensions.cols - board.cutouts.count
    }
}
