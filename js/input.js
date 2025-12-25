
export class InputHandler {
    constructor(game, renderer, onInteraction) {
        this.game = game;
        this.renderer = renderer;
        this.canvas = renderer.canvas;
        this.onInteraction = onInteraction; // callback to request render/check win

        this.draggingPiece = null;
        this.dragOffset = { x: 0, y: 0 }; // Offset from top-left of piece to cursor
        this.dragStartPos = { x: 0, y: 0 }; // For tap detection
        this.dragStartTime = 0;

        // Mobile offset config
        this.visualDragOffset = 0; // Pixels to shift piece UP when dragging

        this.bindEvents();
    }

    bindEvents() {
        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleStart(e.touches[0], true);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (this.draggingPiece) e.preventDefault();
            this.handleMove(e.touches[0], true);
        }, { passive: false });
        window.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });

        // Mouse
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e, false));
        window.addEventListener('mousemove', (e) => this.handleMove(e, false));
        window.addEventListener('mouseup', (e) => this.handleEnd(e));

    }

    // Convert event client coords to canvas relative coords
    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleStart(input, isTouch) {
        // preventDefault now handled in bindEvents

        const pos = this.getCanvasCoords(input);
        const gridPos = this.renderer.pixelToGrid(pos.x, pos.y);

        // Find piece under cursor
        // We iterate in reverse to pick top-most if overlap
        for (let i = this.game.pieces.length - 1; i >= 0; i--) {
            const p = this.game.pieces[i];

            // Simple bounding box check first
            // Note: piece.x/y is top-left in grid units.
            // Check if gridPos is within piece bounding box?
            // More precise: check specific blocks.

            // Check if cursor hits any block of the piece
            const hit = p.currentShape.some(block => {
                const bx = p.x + block.x;
                const by = p.y + block.y;
                return (
                    gridPos.x >= bx && gridPos.x < bx + 1 &&
                    gridPos.y >= by && gridPos.y < by + 1
                );
            });

            if (hit) {
                this.draggingPiece = p;

                // Set offsets
                this.dragOffset = {
                    x: gridPos.x - p.x,
                    y: gridPos.y - p.y
                };

                this.dragStartPos = { ...pos };
                this.dragStartTime = Date.now();

                // Mobile: Lift piece up visually so finger doesn't hide it
                // We add a vertical offset in PIXELS
                this.visualDragOffset = isTouch ? 100 : 0;

                // Move piece to "active" layer (end of list)
                // Remove and push
                this.game.pieces.splice(i, 1);
                this.game.pieces.push(p);

                this.onInteraction();
                return;
            }
        }
    }

    handleMove(input, isTouch) {
        if (!this.draggingPiece) return;
        // preventDefault now handled in bindEvents

        const pos = this.getCanvasCoords(input);

        // Apply visual offset (Finger is below piece)
        // pos.y is finger. Piece should be at pos.y - visualOFfset
        const targetScreenY = pos.y - this.visualDragOffset;

        const gridPos = this.renderer.pixelToGrid(pos.x, targetScreenY);

        // Update piece position (Fractional is fine during drag)
        this.game.updatePieceState(this.draggingPiece.id, {
            x: gridPos.x - this.dragOffset.x,
            y: gridPos.y - this.dragOffset.y
        });

        this.onInteraction();
    }

    handleEnd(e) {
        if (!this.draggingPiece) return;

        // Check for Tap (Rotate)
        const now = Date.now();
        const pos = this.getCanvasCoords(e.changedTouches ? e.changedTouches[0] : e);
        const dist = Math.hypot(pos.x - this.dragStartPos.x, pos.y - this.dragStartPos.y);

        if (dist < 10 && (now - this.dragStartTime) < 300) {
            // Tap detected
            this.handleRotate(this.draggingPiece);
        }

        // Snap to grid
        let snappedX = Math.round(this.draggingPiece.x);
        let snappedY = Math.round(this.draggingPiece.y);

        // Constraint: Keep piece within the 5-wide board horizontally
        const shape = this.draggingPiece.currentShape;
        const pieceW = Math.max(...shape.map(p => p.x)) + 1;
        snappedX = Math.max(0, Math.min(snappedX, 5 - pieceW));
        snappedY = Math.max(0, snappedY);

        // Validation: Piece must be ENTIRELY on valid target spots (1s in grid)
        // OR entirely in dock area (below grid). No partial placements allowed.
        let isValid = true;
        const grid = this.game.targetGrid;
        const rows = grid.length;
        const cols = grid[0].length;

        for (const block of shape) {
            const bx = snappedX + block.x;
            const by = snappedY + block.y;

            // Check if block is inside the board area
            if (by >= 0 && by < rows && bx >= 0 && bx < cols) {
                // Inside board - must be on a target spot (1)
                if (grid[by][bx] !== 1) {
                    isValid = false;
                    break;
                }
            } else if (by < rows) {
                // Block is horizontally outside board but vertically inside - invalid
                isValid = false;
                break;
            }
            // If by >= rows (dock area), that's allowed - piece stays in dock
        }

        if (!isValid) {
            // Revert to Dock
            snappedX = this.draggingPiece.dockX;
            snappedY = this.draggingPiece.dockY;
        }

        this.game.updatePieceState(this.draggingPiece.id, {
            x: snappedX,
            y: snappedY
        });

        this.draggingPiece = null;
        this.visualDragOffset = 0;
        this.onInteraction(true); // true = check win
    }

    handleRotate(piece) {
        const newRot = (piece.rotation + 1) % 4;
        this.game.updatePieceState(piece.id, { rotation: newRot });
        this.onInteraction();
    }
}
