import SwiftUI

struct GameView: View {
    @ObservedObject var game: GameState
    let puzzle: Puzzle
    let accent: Color
    @State private var dragOrigins: [Int: CGPoint] = [:]
    @State private var showControls = false

    private var cellSize: CGFloat { min(42, max(24, UIScreen.main.bounds.width / CGFloat(puzzle.boardCols + 1))) }
    private var boardHeight: CGFloat { CGFloat(puzzle.boardRows) * cellSize }

    var body: some View {
        VStack(spacing: 8) {
            header
            ScrollView([.vertical, .horizontal], showsIndicators: false) {
                ZStack(alignment: .topLeading) {
                    boardLayer
                    if let hint = game.hint {
                        GhostPieceView(hint: hint, cellSize: cellSize)
                            .position(x: (CGFloat(hint.column) + CGFloat(hint.shape.width) / 2) * cellSize,
                                      y: (CGFloat(hint.row) + CGFloat(hint.shape.height) / 2) * cellSize)
                            .accessibilityLabel("Ghost hint for piece \(hint.pieceID + 1)")
                    }
                    ForEach(puzzle.pieces) { piece in
                        PieceView(piece: piece, cellSize: cellSize, accent: accent,
                                  isHinted: game.hint?.pieceID == piece.id)
                            .position(x: (CGFloat(piece.x) + CGFloat(piece.shape.width) / 2) * cellSize,
                                      y: (CGFloat(piece.y) + CGFloat(piece.shape.height) / 2) * cellSize)
                            .gesture(pieceGesture(piece))
                            .onTapGesture { game.rotate(pieceID: piece.id) }
                            .accessibilityHint("Drag to move, tap to rotate, or swipe quickly to flip")
                    }
                }
                .frame(width: CGFloat(puzzle.boardCols) * cellSize,
                       height: CGFloat(puzzle.boardRows + 9) * cellSize)
                .padding(.horizontal, 8)
            }
            if showControls { accessibleControls }
            Button(showControls ? "Hide Accessible Controls" : "Show Accessible Controls") {
                withAnimation { showControls.toggle() }
            }
            .font(.footnote)
            .accessibilityHint("Offers non-drag controls for placing and transforming pieces")
        }
        .padding(.top, 8)
        .overlay(alignment: .topTrailing) {
            Button { game.showMenu() } label: { Image(systemName: "line.3.horizontal") }
                .padding()
                .accessibilityLabel("Open menu")
        }
        .overlay {
            if game.didWin {
                VStack(spacing: 14) {
                    Text("LEVEL COMPLETE!")
                        .font(.title.bold().monospaced())
                        .foregroundStyle(accent)
                        .accessibilityAddTraits(.isHeader)
                    Button("Next Level") { game.advanceAfterWin() }
                        .buttonStyle(NeonButtonStyle(color: accent))
                        .accessibilityHint("Starts the next generated puzzle")
                }
                .padding()
                .background(.black.opacity(0.9), in: RoundedRectangle(cornerRadius: 18))
                .transition(game.progress.reduceMotion ? .identity : .scale)
                if !game.progress.reduceMotion { ConfettiView(color: accent).allowsHitTesting(false) }
            }
        }
    }

    private var header: some View {
        HStack {
            Text("POLYFIT")
                .font(.title2.bold().monospaced())
                .foregroundStyle(accent)
                .onTapGesture { game.titleTapped() }
                .accessibilityLabel("PolyFit title. Tap five times for hint cheat")
            Spacer()
            Text("LEVEL \(puzzle.level)")
                .font(.headline.monospaced())
                .foregroundStyle(.secondary)
                .accessibilityLabel("Level \(puzzle.level)")
        }
        .padding(.horizontal)
    }

    private var boardLayer: some View {
        Canvas { context, _ in
            let boardWidth = CGFloat(puzzle.boardCols) * cellSize
            for row in 0..<puzzle.boardRows {
                for column in 0..<puzzle.boardCols {
                    let rectangle = CGRect(x: CGFloat(column) * cellSize + 1,
                                           y: CGFloat(row) * cellSize + 1,
                                           width: cellSize - 2, height: cellSize - 2)
                    let value = puzzle.targetGrid[row][column]
                    let fill: Color = value == -2 ? .clear : value == -1 ? .gray.opacity(0.25) : value == 1 ? accent.opacity(0.18) : .white.opacity(0.04)
                    if value == -1 {
                        context.fill(Path(ellipseIn: rectangle.insetBy(dx: cellSize * 0.3, dy: cellSize * 0.3)), with: .color(.gray))
                    } else if value != -2 {
                        context.fill(Path(roundedRect: rectangle, cornerRadius: 4), with: .color(fill))
                        context.stroke(Path(roundedRect: rectangle, cornerRadius: 4), with: .color(accent.opacity(0.35)), lineWidth: 1)
                    }
                }
            }
            let dockY = CGFloat(puzzle.boardRows + 1) * cellSize
            context.stroke(Path(CGRect(x: 0, y: dockY, width: boardWidth, height: cellSize * 7)), with: .color(accent.opacity(0.2)), lineWidth: 1)
        }
        .frame(width: CGFloat(puzzle.boardCols) * cellSize, height: CGFloat(puzzle.boardRows + 9) * cellSize)
        .accessibilityLabel("Puzzle board with \(puzzle.boardRows) rows and \(puzzle.boardCols) columns")
    }

    private var accessibleControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Accessible piece controls").font(.headline)
            ForEach(puzzle.pieces) { piece in
                HStack {
                    Text("Piece \(piece.id + 1), \(piece.shapeName.rawValue)")
                        .foregroundStyle(Color(hex: piece.colorHex))
                    Spacer()
                    Button("Place") { game.placeAccessibly(pieceID: piece.id) }
                    Button("Rotate") { game.rotate(pieceID: piece.id) }
                    Button("Flip") { game.flip(pieceID: piece.id) }
                }
                .font(.caption)
                .buttonStyle(.bordered)
            }
            if game.hint != nil {
                Button("Hide hint") { game.hideHint() }
            } else {
                Button("Show hint") { _ = game.getHint() }
            }
        }
        .padding(.horizontal)
        .accessibilityElement(children: .contain)
    }

    private func pieceGesture(_ piece: PieceState) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if dragOrigins[piece.id] == nil { dragOrigins[piece.id] = CGPoint(x: piece.x, y: piece.y) }
                guard let origin = dragOrigins[piece.id] else { return }
                let column = Int(round(origin.x + value.translation.width / cellSize))
                let row = Int(round(origin.y + value.translation.height / cellSize))
                game.move(pieceID: piece.id, column: column, row: row)
            }
            .onEnded { value in
                dragOrigins[piece.id] = nil
                if abs(value.translation.width) >= 30 && abs(value.translation.height) < 18 {
                    game.flip(pieceID: piece.id)
                } else if let currentPiece = game.puzzle?.pieces.first(where: { $0.id == piece.id }) {
                    game.snap(pieceID: piece.id, column: currentPiece.x, row: currentPiece.y)
                }
            }
    }
}

struct GhostPieceView: View {
    let hint: Hint
    let cellSize: CGFloat

    var body: some View {
        ZStack {
            ForEach(hint.shape.cells, id: \.self) { cell in
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color(hex: hint.colorHex), style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                    .frame(width: cellSize - 3, height: cellSize - 3)
                    .offset(x: CGFloat(cell.column) * cellSize, y: CGFloat(cell.row) * cellSize)
            }
        }
        .frame(width: CGFloat(hint.shape.width) * cellSize, height: CGFloat(hint.shape.height) * cellSize)
    }
}

struct ConfettiView: View {
    let color: Color
    @State private var animate = false

    var body: some View {
        Canvas { context, size in
            for particleIndex in 0..<24 {
                let horizontal = CGFloat((particleIndex * 37) % 100) / 100 * size.width
                let vertical = animate ? size.height : size.height * 0.25
                let rectangle = CGRect(x: horizontal, y: vertical, width: 5, height: 10)
                context.fill(Path(rectangle), with: .color(particleIndex.isMultiple(of: 2) ? color : .white))
            }
        }
        .allowsHitTesting(false)
        .onAppear { withAnimation(.easeOut(duration: 1.2)) { animate = true } }
    }
}

struct PieceView: View {
    let piece: PieceState
    let cellSize: CGFloat
    let accent: Color
    let isHinted: Bool

    var body: some View {
        ZStack {
            ForEach(piece.shape.cells, id: \.self) { cell in
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: piece.colorHex).opacity(isHinted ? 0.45 : 0.85))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(isHinted ? .white : accent, lineWidth: isHinted ? 3 : 1))
                    .frame(width: cellSize - 3, height: cellSize - 3)
                    .offset(x: CGFloat(cell.column) * cellSize, y: CGFloat(cell.row) * cellSize)
            }
        }
        .frame(width: CGFloat(piece.shape.width) * cellSize, height: CGFloat(piece.shape.height) * cellSize)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Piece \(piece.id + 1), \(piece.shapeName.rawValue)")
        .accessibilityValue("Position \(piece.x), \(piece.y)")
    }
}
