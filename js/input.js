import { sounds } from './sounds.js';
import { haptics } from './haptics.js';
import { isValidPlacement } from './validation.js';
import {
    TAP_MAX_DISTANCE,
    TAP_MAX_DURATION,
    SWIPE_MIN_DISTANCE,
    SWIPE_MAX_DURATION,
    TOUCH_LIFT_OFFSET,
    DOCK_Y,
    MAX_DOCK_Y,
    DOCK_PIECE_SCALE
} from './config/constants.js';

export class InputHandler {
    constructor(game, renderer, onInteraction) {
        this.game = game;
        this.renderer = renderer;
        this.canvas = renderer.canvas;
        this.onInteraction = onInteraction; // callback to request render/check win

        this.draggingPiece = null;
        this.dragOffset = { x: 0, y: 0 }; // Offset from top-left of piece to cursor
        this.dragStartPos = { x: 0, y: 0 }; // For gesture detection
        this.dragStartTime = 0;
        this.activeTouchId = null; // Track which touch is dragging

        // Mobile offset config
        this.visualDragOffset = 0; // Pixels to shift piece UP when dragging

        this.bindEvents();
    }

    bindEvents() {
        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Use the touch that just started (changedTouches), not all touches
            const touch = e.changedTouches[0];
            this.handleStart(touch, true, touch.identifier);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (this.draggingPiece) e.preventDefault();
            // Find our tracked touch by identifier
            const touch = this.findTouchById(e.touches, this.activeTouchId);
            if (touch) {
                this.handleMove(touch, true);
            }
        }, { passive: false });
        window.addEventListener('touchend', (e) => {
            // Check if our tracked touch ended
            const touch = this.findTouchById(e.changedTouches, this.activeTouchId);
            if (touch) {
                this.handleEnd(e);
            }
        }, { passive: false });

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

    // Find a touch by its identifier in a TouchList
    findTouchById(touchList, id) {
        if (id === null) return null;
        for (let i = 0; i < touchList.length; i++) {
            if (touchList[i].identifier === id) {
                return touchList[i];
            }
        }
        return null;
    }

    // Find nearest available dock position for a piece
    findNearestDockPosition(piece, targetX, targetY) {
        const shape = piece.currentShape;
        const pieceW = Math.max(...shape.map(p => p.x)) + 1;
        const pieceH = Math.max(...shape.map(p => p.y)) + 1;

        // Get other pieces in dock (excluding this one)
        const otherDockPieces = this.game.pieces.filter(p =>
            p !== piece && p.y >= DOCK_Y
        );

        // Build occupancy grid for dock area
        const dockOccupied = new Set();
        otherDockPieces.forEach(p => {
            p.currentShape.forEach(block => {
                const key = `${Math.round(p.x + block.x)},${Math.round(p.y + block.y)}`;
                dockOccupied.add(key);
            });
        });

        // Check if a position is valid for this piece
        const canPlace = (x, y) => {
            // Bounds check
            if (x < 0 || x + pieceW > 5) return false;
            if (y < DOCK_Y || y + pieceH > MAX_DOCK_Y + 1) return false;

            // Collision check
            for (const block of shape) {
                const key = `${x + block.x},${y + block.y}`;
                if (dockOccupied.has(key)) return false;
            }
            return true;
        };

        // Try positions in order of distance from target
        const candidates = [];
        for (let y = DOCK_Y; y <= MAX_DOCK_Y - pieceH + 1; y++) {
            for (let x = 0; x <= 5 - pieceW; x++) {
                if (canPlace(x, y)) {
                    const dist = Math.hypot(x - targetX, y - targetY);
                    candidates.push({ x, y, dist });
                }
            }
        }

        // Sort by distance and return nearest
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates.length > 0 ? candidates[0] : { x: 0, y: DOCK_Y };
    }

    // Snap piece to valid position (extracted for reuse)
    snapPiece(piece) {
        let snappedX = Math.round(piece.x);
        let snappedY = Math.round(piece.y);

        const shape = piece.currentShape;
        const pieceW = Math.max(...shape.map(p => p.x)) + 1;
        snappedX = Math.max(0, Math.min(snappedX, 5 - pieceW));
        snappedY = Math.max(0, snappedY);

        const grid = this.game.targetGrid;
        const otherPieces = this.game.pieces.filter(p => p !== piece);
        const isValid = isValidPlacement(shape, snappedX, snappedY, grid, otherPieces);

        if (!isValid) {
            // Find nearest available dock position
            const dockPos = this.findNearestDockPosition(piece, snappedX, snappedY);
            snappedX = dockPos.x;
            snappedY = dockPos.y;
        }

        this.game.updatePieceState(piece.id, {
            x: snappedX,
            y: snappedY
        });

        return isValid;
    }

    handleStart(input, isTouch, touchId = null) {
        // If already dragging a piece, snap it first to prevent orphaned pieces
        if (this.draggingPiece) {
            this.snapPiece(this.draggingPiece);
            this.draggingPiece = null;
            this.activeTouchId = null;
            this.renderer.draggingPieceId = null;
        }

        const pos = this.getCanvasCoords(input);
        const gridPos = this.renderer.pixelToGrid(pos.x, pos.y);

        // Find piece under cursor
        // We iterate in reverse to pick top-most if overlap
        for (let i = this.game.pieces.length - 1; i >= 0; i--) {
            const p = this.game.pieces[i];

            // Pieces in dock are scaled down - hit detection must match visual size
            const inDock = p.y >= DOCK_Y;
            const scale = inDock ? DOCK_PIECE_SCALE : 1.0;

            // Calculate piece center for scaled hit detection
            const shape = p.currentShape;
            const pieceW = Math.max(...shape.map(b => b.x)) + 1;
            const pieceH = Math.max(...shape.map(b => b.y)) + 1;
            const centerX = p.x + pieceW / 2;
            const centerY = p.y + pieceH / 2;

            // Check if cursor hits any block of the piece (accounting for scale)
            const hit = shape.some(block => {
                const bx = p.x + block.x;
                const by = p.y + block.y;

                // Scale block position relative to piece center
                const scaledBx = centerX + (bx - centerX) * scale;
                const scaledBy = centerY + (by - centerY) * scale;
                const scaledSize = scale;

                return (
                    gridPos.x >= scaledBx && gridPos.x < scaledBx + scaledSize &&
                    gridPos.y >= scaledBy && gridPos.y < scaledBy + scaledSize
                );
            });

            if (hit) {
                this.draggingPiece = p;
                this.activeTouchId = touchId; // Track which touch is dragging
                this.renderer.draggingPieceId = p.id; // Tell renderer which piece is dragging

                // Set offsets
                this.dragOffset = {
                    x: gridPos.x - p.x,
                    y: gridPos.y - p.y
                };

                this.dragStartPos = { ...pos };
                this.dragStartTime = Date.now();

                // Mobile: Lift piece up visually so finger doesn't hide it
                this.visualDragOffset = isTouch ? TOUCH_LIFT_OFFSET : 0;

                // Move piece to "active" layer (end of list)
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
        const newX = gridPos.x - this.dragOffset.x;
        const newY = gridPos.y - this.dragOffset.y;
        this.game.updatePieceState(this.draggingPiece.id, {
            x: newX,
            y: newY
        });

        // Calculate and show ghost preview at snap position
        this.updateGhostPreview(this.draggingPiece, newX, newY);

        this.onInteraction();
    }

    updateGhostPreview(piece, currentX, currentY) {
        const shape = piece.currentShape;
        const pieceW = Math.max(...shape.map(p => p.x)) + 1;
        const pieceH = Math.max(...shape.map(p => p.y)) + 1;

        // Calculate snap position
        let snapX = Math.round(currentX);
        let snapY = Math.round(currentY);
        snapX = Math.max(0, Math.min(snapX, 5 - pieceW));
        snapY = Math.max(0, snapY);

        const grid = this.game.targetGrid;
        const rows = grid.length;
        const otherPieces = this.game.pieces.filter(p => p !== piece);
        const isValid = isValidPlacement(shape, snapX, snapY, grid, otherPieces);

        // Show ghost if piece overlaps with board area (any part of piece above dock)
        // This gives visual feedback based on where piece is drawn, not finger position
        const pieceTopY = snapY;
        const pieceBottomY = snapY + pieceH - 1;
        const overlapsBoard = pieceTopY < rows;

        if (overlapsBoard && snapY < rows) {
            this.renderer.setGhostPreview(shape, snapX, snapY, piece.color, isValid);
        } else {
            this.renderer.clearGhostPreview();
        }
    }

    handleEnd(e) {
        if (!this.draggingPiece) return;

        // Clear ghost preview
        this.renderer.clearGhostPreview();

        const now = Date.now();
        const pos = this.getCanvasCoords(e.changedTouches ? e.changedTouches[0] : e);
        const dist = Math.hypot(pos.x - this.dragStartPos.x, pos.y - this.dragStartPos.y);
        const duration = now - this.dragStartTime;

        // Gesture detection: swipe vs tap vs drag
        if (dist >= SWIPE_MIN_DISTANCE && duration < SWIPE_MAX_DURATION) {
            // Fast swipe → Flip
            this.handleFlip(this.draggingPiece);
        } else if (dist < TAP_MAX_DISTANCE && duration < TAP_MAX_DURATION) {
            // Tap → Rotate
            this.handleRotate(this.draggingPiece);
        }
        // Else: regular drag, just snap to grid

        // Snap to grid
        let snappedX = Math.round(this.draggingPiece.x);
        let snappedY = Math.round(this.draggingPiece.y);

        // Constraint: Keep piece within the 5-wide board horizontally
        const shape = this.draggingPiece.currentShape;
        const pieceW = Math.max(...shape.map(p => p.x)) + 1;
        snappedX = Math.max(0, Math.min(snappedX, 5 - pieceW));
        snappedY = Math.max(0, snappedY);

        const grid = this.game.targetGrid;
        const rows = grid.length;
        const otherPieces = this.game.pieces.filter(p => p !== this.draggingPiece);
        const isValid = isValidPlacement(shape, snappedX, snappedY, grid, otherPieces);

        if (!isValid || snappedY >= rows) {
            // Invalid placement or dropped in dock area - find nearest dock position
            const dockPos = this.findNearestDockPosition(this.draggingPiece, snappedX, snappedY);
            snappedX = dockPos.x;
            snappedY = dockPos.y;
        } else {
            // Valid placement on the board - play snap sound & haptic
            sounds.playSnap();
            haptics.vibrateSnap();
        }

        this.game.updatePieceState(this.draggingPiece.id, {
            x: snappedX,
            y: snappedY
        });

        this.draggingPiece = null;
        this.activeTouchId = null;
        this.visualDragOffset = 0;
        this.renderer.draggingPieceId = null; // Clear dragging state in renderer
        this.onInteraction(true); // true = check win
    }

    handleRotate(piece) {
        const newRot = (piece.rotation + 1) % 4;
        this.game.updatePieceState(piece.id, { rotation: newRot });
        sounds.playRotate();
        haptics.vibrateRotate();
        this.onInteraction();
    }

    handleFlip(piece) {
        this.game.updatePieceState(piece.id, { flipped: !piece.flipped });
        sounds.playFlip();
        haptics.vibrateFlip();
        this.onInteraction();
    }
}
