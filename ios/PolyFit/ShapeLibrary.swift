import Foundation

public enum ShapeLibrary {
    public static let shapes: [ShapeName: PolyShape] = [
        .domino: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1)]),
        .line3: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 0, row: 2)]),
        .corner3: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 1, row: 1)]),
        .tShape: PolyShape([Cell(column: 0, row: 0), Cell(column: 1, row: 0), Cell(column: 2, row: 0), Cell(column: 1, row: 1)]),
        .lShape: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 0, row: 2), Cell(column: 1, row: 2)]),
        .sShape: PolyShape([Cell(column: 1, row: 0), Cell(column: 2, row: 0), Cell(column: 0, row: 1), Cell(column: 1, row: 1)]),
        .square: PolyShape([Cell(column: 0, row: 0), Cell(column: 1, row: 0), Cell(column: 0, row: 1), Cell(column: 1, row: 1)]),
        .line4: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 0, row: 2), Cell(column: 0, row: 3)]),
        .cShape: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 0, row: 2), Cell(column: 1, row: 0), Cell(column: 1, row: 2)]),
        .pShape: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 0, row: 2), Cell(column: 1, row: 0), Cell(column: 1, row: 1)]),
        .l5Shape: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 0, row: 2), Cell(column: 0, row: 3), Cell(column: 1, row: 3)]),
        .wShape: PolyShape([Cell(column: 0, row: 0), Cell(column: 1, row: 0), Cell(column: 1, row: 1), Cell(column: 1, row: 2), Cell(column: 2, row: 2)]),
        .yShape: PolyShape([Cell(column: 0, row: 0), Cell(column: 0, row: 1), Cell(column: 1, row: 1), Cell(column: 0, row: 2), Cell(column: 0, row: 3)])
    ]

    public static let colors: [String] = [
        "#F92672", "#00E5FF", "#A6E22E", "#FD971F",
        "#AE81FF", "#E6DB74", "#FF3333", "#F8F8F2"
    ]

    public static func rotate(_ shape: PolyShape) -> PolyShape {
        PolyShape(shape.cells.map { Cell(column: -$0.row, row: $0.column) })
    }

    public static func flip(_ shape: PolyShape) -> PolyShape {
        PolyShape(shape.cells.map { Cell(column: -$0.column, row: $0.row) })
    }

    public static func normalize(_ shape: PolyShape) -> PolyShape {
        guard let minimumColumn = shape.cells.map(\.column).min(),
              let minimumRow = shape.cells.map(\.row).min() else { return shape }
        return PolyShape(shape.cells.map {
            Cell(column: $0.column - minimumColumn, row: $0.row - minimumRow)
        })
    }

    public static func transformed(_ baseShape: PolyShape, rotation: Int, flipped: Bool) -> PolyShape {
        var result = flipped ? flip(baseShape) : baseShape
        for _ in 0..<(rotation % 4) { result = rotate(result) }
        return normalize(result)
    }

    public static func orientations(of baseShape: PolyShape) -> [PolyShape] {
        var result: [PolyShape] = []
        for flipState in 0...1 {
            for rotation in 0..<4 {
                let orientation = transformed(baseShape, rotation: rotation, flipped: flipState == 1)
                if !result.contains(orientation) { result.append(orientation) }
            }
        }
        return result
    }

    public static func signature(_ shape: PolyShape) -> String {
        normalize(shape).cells
            .sorted { $0.row == $1.row ? $0.column < $1.column : $0.row < $1.row }
            .map { "\($0.column),\($0.row)" }
            .joined(separator: ";")
    }
}
