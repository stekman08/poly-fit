import { sounds } from './sounds.js';
import { haptics } from './haptics.js';
import { isValidPlacement, buildOccupancyCache, clearOccupancyCache } from './validation.js';
import { getShapeDimensions } from './shapes.js';
import {
    TAP_MAX_DISTANCE,
    TAP_MAX_DURATION,
    SWIPE_MIN_DISTANCE,
    SWIPE_MAX_DURATION,
    FAT_FINGER_RADIUS,
    TOUCH_MOUSE_DEBOUNCE,
    getDockY,
    getMaxDockY
} from './config/constants.js';

/**
 * Simplified InputHandler for DOM-based rendering
 * Key differences from canvas version:
 * - No visualDragOffset (finger lift) - not needed for DOM
 * - Piece doesn't move until actual drag detected (tap works properly)
 * - Uses DOM element positions directly
 */
export class InputHandler {
    constructor(game, renderer, onInteraction) {
        this.game = game;
        this.renderer = renderer;
        this.container = document.getElementById('game-container');
        this.onInteraction = onInteraction;

        this.draggingPiece = null;
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragStartTime = 0;
        this.activeTouchId = null;
        this.hasInteraction = false;
        this.lastTouchTime = 0;
        this.dragStartGridPos = null;
        this.dragStartScreenPos = null;
        this.cachedOtherPieces = null;
        this.grabFlashTimeout = null;
        this.cachedPieceRects = null;

        this.bindEvents();
    }

    getBoardRows() {
        return this.game.targetGrid?.length || 5;
    }

    bindEvents() {
        // Touch events
        this.container.addEventListener('touchstart', (e) => {
            this.lastTouchTime = Date.now();
            const isUIElement = e.target.closest('#ui-layer, #start-screen, #tutorial-overlay, #level-select-screen, #loading-overlay');
            if (isUIElement && !e.target.closest('.piece')) {
                return;
            }
            const touch = e.changedTouches[0];
            this.handleStart(touch.clientX, touch.clientY, true, touch.identifier);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (this.draggingPiece) {
                const touch = this.findTouchById(e.touches, this.activeTouchId);
                if (touch) {
                    this.handleMove(touch.clientX, touch.clientY);
                }
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            this.lastTouchTime = Date.now();
            if (this.draggingPiece) {
                const touch = this.findTouchById(e.changedTouches, this.activeTouchId) || e.changedTouches[0];
                this.handleEnd(touch?.clientX ?? this.dragStartPos.x, touch?.clientY ?? this.dragStartPos.y);
            }
        }, { passive: true });

        window.addEventListener('touchcancel', () => {
            if (this.draggingPiece) {
                this.cancelDrag();
            }
        }, { passive: true });

        // Mouse events - ignore if triggered by touch compatibility
        this.container.addEventListener('mousedown', (e) => {
            // Ignore mouse events after touch (browser compatibility behavior)
            if (Date.now() - this.lastTouchTime < TOUCH_MOUSE_DEBOUNCE) {
                return;
            }
            this.handleStart(e.clientX, e.clientY, false);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.draggingPiece) {
                this.handleMove(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (this.draggingPiece) {
                this.handleEnd(e.clientX, e.clientY);
            }
        });
    }

    findTouchById(touchList, id) {
        if (id === null) return null;
        for (let i = 0; i < touchList.length; i++) {
            if (touchList[i].identifier === id) {
                return touchList[i];
            }
        }
        return null;
    }

    findClosestPieceElement(x, y) {
        let closestEl = null;
        let minDist = Infinity;

        // Iterate all rendered pieces
        if (this.renderer.pieceElements) {
            for (const [id, el] of this.renderer.pieceElements) {
                // Use cached rect if available (avoids layout thrashing during drag)
                const rect = this.cachedPieceRects?.get(String(id)) || el.getBoundingClientRect();

                // Calculate distance to rectangle (0 if inside)
                const dx = Math.max(rect.left - x, 0, x - rect.right);
                const dy = Math.max(rect.top - y, 0, y - rect.bottom);
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < FAT_FINGER_RADIUS && dist < minDist) {
                    minDist = dist;
                    closestEl = el;
                }
            }
        }
        return closestEl;
    }

    handleStart(clientX, clientY, isTouch, touchId = null) {
        // Prevent double handling (e.g., both touch and mouse events firing)
        if (this.hasInteraction) return;
        this.hasInteraction = true;

        try {
            // Find piece under touch point
            let el = document.elementFromPoint(clientX, clientY);
            let pieceEl = el ? el.closest('.piece') : null;

            // Sticky Touch: If no piece found directly, look for closest one nearby
            if (!pieceEl) {
                pieceEl = this.findClosestPieceElement(clientX, clientY);
            }

            if (!pieceEl || !pieceEl.dataset.pieceId) {
                this.hasInteraction = false;
                return;
            }

            const piece = this.game.pieces.find(p => String(p.id) === pieceEl.dataset.pieceId);
            if (!piece) {
                this.hasInteraction = false;
                return;
            }

            // Store drag state
            this.draggingPiece = piece;
            this.isDragging = false; // Not dragging yet, could be a tap
            this.dragStartPos = { x: clientX, y: clientY };
            this.dragStartTime = Date.now();
            this.activeTouchId = isTouch ? touchId : null;

            // Calculate the piece's ACTUAL grid position from its DOM position
            // This is crucial because dock pieces use flexbox positioning (piece.x/y are virtual),
            // while board pieces use absolute positioning (piece.x/y match grid coords).
            // By calculating from DOM, we get consistent behavior for both.
            const pieceRect = pieceEl.getBoundingClientRect();
            const boardRect = this.renderer.getBoardRect();
            const cellSize = this.renderer.cellSize;

            // Convert piece's top-left corner from screen pixels to board grid coordinates
            const actualGridX = (pieceRect.left - boardRect.left) / cellSize;
            const actualGridY = (pieceRect.top - boardRect.top) / cellSize;

            this.dragStartGridPos = { x: actualGridX, y: actualGridY };
            this.dragStartScreenPos = { x: clientX, y: clientY };

            // Move piece to front (end of array)
            const idx = this.game.pieces.indexOf(piece);
            if (idx > -1) {
                this.game.pieces.splice(idx, 1);
                this.game.pieces.push(piece);
            }

            // Build occupancy cache for this drag session (performance optimization)
            // Cache both the array and the Set to avoid filter() on every touchmove
            this.cachedOtherPieces = this.game.pieces.filter(p => p !== piece);
            buildOccupancyCache(this.cachedOtherPieces, this.game.targetGrid);

            // Cache piece rects to avoid layout thrashing during drag
            // (getBoundingClientRect forces layout recalculation)
            this.cachedPieceRects = new Map();
            for (const [id, el] of this.renderer.pieceElements) {
                if (String(id) !== String(piece.id)) {
                    this.cachedPieceRects.set(String(id), el.getBoundingClientRect());
                }
            }

            // Ensure animation loop is running for drag updates
            if (window.ensureLoopRunning) window.ensureLoopRunning();

            pieceEl.classList.add('grab-flash');
            if (this.grabFlashTimeout) clearTimeout(this.grabFlashTimeout);
            this.grabFlashTimeout = setTimeout(() => {
                pieceEl.classList.remove('grab-flash');
                this.grabFlashTimeout = null;
            }, 200);

            // DON'T move the piece yet - wait for actual drag detection
            this.onInteraction();
        } catch (e) {
            // Ensure interaction state is reset on unexpected errors
            this.hasInteraction = false;
            throw e;
        }
    }

    handleMove(clientX, clientY) {
        if (!this.draggingPiece) return;

        const dist = Math.hypot(clientX - this.dragStartPos.x, clientY - this.dragStartPos.y);

        // Start actual drag only after movement threshold
        if (!this.isDragging && dist > TAP_MAX_DISTANCE) {
            this.isDragging = true;
            this.renderer.draggingPieceId = this.draggingPiece.id;
            // Pass original grid position to renderer for accurate offset calculation
            this.renderer.dragStartGridPos = { ...this.dragStartGridPos };
        }

        if (this.isDragging) {
            // Calculate delta movement in screen pixels, then convert to grid units
            const cellSize = this.renderer.cellSize;
            const deltaX = (clientX - this.dragStartScreenPos.x) / cellSize;
            const deltaY = (clientY - this.dragStartScreenPos.y) / cellSize;

            // Apply delta to original grid position
            const gridPos = {
                x: this.dragStartGridPos.x + deltaX,
                y: this.dragStartGridPos.y + deltaY
            };

            // Update piece position (fractional during drag)
            this.game.updatePieceState(this.draggingPiece.id, {
                x: gridPos.x,
                y: gridPos.y
            });

            // Show ghost preview at snap position
            this.updateGhostPreview(gridPos.x, gridPos.y);

            // Request render for visual update during drag
            if (window.requestRender) window.requestRender();
            this.onInteraction();
        }
    }

    updateGhostPreview(currentX, currentY) {
        const piece = this.draggingPiece;
        const shape = piece.currentShape;
        const { width: pieceW, height: pieceH } = getShapeDimensions(shape);
        const boardCols = this.game.targetGrid?.[0]?.length || 5;
        const boardRows = this.game.targetGrid?.length || 5;

        // Calculate snap position
        let snapX = Math.round(currentX);
        let snapY = Math.round(currentY);
        snapX = Math.max(0, Math.min(snapX, boardCols - pieceW));
        snapY = Math.max(0, snapY);

        // Use cached array to avoid filter() on every touchmove (60x/sec)
        const otherPieces = this.cachedOtherPieces || this.game.pieces.filter(p => p !== piece);
        const isValid = isValidPlacement(shape, snapX, snapY, this.game.targetGrid, otherPieces);

        // Show ghost only for valid board placements
        if (isValid && snapY < boardRows) {
            this.renderer.setGhostPreview(shape, snapX, snapY, piece.color, true);
        } else {
            this.renderer.clearGhostPreview();
        }
    }

    handleEnd(clientX, clientY) {
        if (!this.draggingPiece) {
            this.hasInteraction = false;
            return;
        }

        try {
            this.renderer.clearGhostPreview();

            const dist = Math.hypot(clientX - this.dragStartPos.x, clientY - this.dragStartPos.y);
            const duration = Date.now() - this.dragStartTime;

            // Check for swipe gesture FIRST (fast movement over threshold distance)
            // This takes priority over drag, allowing flip even if isDragging became true
            if (dist >= SWIPE_MIN_DISTANCE && duration < SWIPE_MAX_DURATION) {
                // Fast swipe = Flip, then snap back to valid position
                this.handleFlip();
                this.snapPieceToGrid();
            } else if (!this.isDragging) {
                // No significant drag - check for tap
                if (dist < TAP_MAX_DISTANCE && duration < TAP_MAX_DURATION) {
                    // Tap = Rotate
                    this.handleRotate();
                }
                // Piece stays where it was (no snap needed)
            } else {
                // Was dragging (slow movement) - snap piece to valid position
                this.snapPieceToGrid();
            }
        } finally {
            this.resetDragState();
        }
    }

    handleRotate() {
        const piece = this.draggingPiece;
        const boardRows = this.getBoardRows();
        const wasOnBoard = piece.y < boardRows;

        // Always allow rotation
        const newRot = (piece.rotation + 1) % 4;
        this.game.updatePieceState(piece.id, { rotation: newRot });
        sounds.playRotate();
        haptics.vibrateRotate();

        // Only snap if piece was on the board (not in dock)
        if (wasOnBoard) {
            this.snapToValidPosition(piece);
        }
        this.onInteraction();
    }

    handleFlip() {
        const piece = this.draggingPiece;
        const boardRows = this.getBoardRows();
        const wasOnBoard = piece.y < boardRows;

        // Always allow flip
        this.game.updatePieceState(piece.id, { flipped: !piece.flipped });
        sounds.playFlip();
        haptics.vibrateFlip();

        // Only snap if piece was on the board (not in dock)
        if (wasOnBoard) {
            this.snapToValidPosition(piece);
        }
        this.onInteraction();
    }

    // Public API for snapping a piece to valid position (used by tests)
    snapPiece(piece) {
        if (!piece) piece = this.draggingPiece;
        if (!piece) return;

        this._snapPieceToValidPosition(piece);
    }

    snapPieceToGrid() {
        const piece = this.draggingPiece;
        if (!piece) return;

        this._snapPieceToValidPosition(piece);
    }

    _snapPieceToValidPosition(piece) {
        const shape = piece.currentShape;
        const { width: pieceW } = getShapeDimensions(shape);
        const boardCols = this.game.targetGrid?.[0]?.length || 5;
        const boardRows = this.game.targetGrid?.length || 5;

        // Calculate snap position
        let snapX = Math.round(piece.x);
        let snapY = Math.round(piece.y);
        snapX = Math.max(0, Math.min(snapX, boardCols - pieceW));
        snapY = Math.max(0, snapY);

        // Use cached array when available
        const otherPieces = this.cachedOtherPieces || this.game.pieces.filter(p => p !== piece);
        const isValid = isValidPlacement(shape, snapX, snapY, this.game.targetGrid, otherPieces);

        if (isValid && snapY < boardRows) {
            // Valid board placement
            sounds.playSnap();
            haptics.vibrateSnap();
        } else {
            // Invalid - return to dock
            const dockPos = this.findNearestDockPosition(piece, snapX, snapY);
            snapX = dockPos.x;
            snapY = dockPos.y;
        }

        this.game.updatePieceState(piece.id, { x: snapX, y: snapY });
        this.onInteraction(true); // Check win
    }

    findNearestDockPosition(piece, targetX, targetY) {
        const shape = piece.currentShape;
        const { width: pieceW, height: pieceH } = getShapeDimensions(shape);
        const boardRows = this.getBoardRows();
        const dockY = getDockY(boardRows);
        const maxDockY = getMaxDockY(boardRows);
        const boardCols = this.game.targetGrid?.[0]?.length || 5;

        // Get other pieces in dock
        const otherDockPieces = this.game.pieces.filter(p =>
            p !== piece && p.y >= dockY
        );

        // Build occupancy grid
        const dockOccupied = new Set();
        otherDockPieces.forEach(p => {
            p.currentShape.forEach(block => {
                const key = `${Math.round(p.x + block.x)},${Math.round(p.y + block.y)}`;
                dockOccupied.add(key);
            });
        });

        const canPlace = (x, y) => {
            if (x < 0 || x + pieceW > boardCols) return false;
            if (y < dockY || y + pieceH > maxDockY + 1) return false;
            for (const block of piece.currentShape) {
                const key = `${x + block.x},${y + block.y}`;
                if (dockOccupied.has(key)) return false;
            }
            return true;
        };

        // Find nearest valid position
        const candidates = [];
        for (let y = dockY; y <= maxDockY - pieceH + 1; y++) {
            for (let x = 0; x <= boardCols - pieceW; x++) {
                if (canPlace(x, y)) {
                    const dist = Math.hypot(x - targetX, y - targetY);
                    candidates.push({ x, y, dist });
                }
            }
        }

        candidates.sort((a, b) => a.dist - b.dist);
        return candidates.length > 0 ? candidates[0] : { x: 0, y: dockY };
    }

    snapToValidPosition(piece) {
        const shape = piece.currentShape;
        const boardRows = this.game.targetGrid?.length || 5;
        const boardCols = this.game.targetGrid?.[0]?.length || 5;
        // Use cached array when available
        const otherPieces = this.cachedOtherPieces || this.game.pieces.filter(p => p !== piece);

        const currentX = Math.round(piece.x);
        const currentY = Math.round(piece.y);

        // First: try current position
        if (isValidPlacement(shape, currentX, currentY, this.game.targetGrid, otherPieces)) {
            this.game.updatePieceState(piece.id, { x: currentX, y: currentY });
            return;
        }

        // Second: search for nearest valid position on board
        const boardPos = this.findNearestBoardPosition(piece, shape, currentX, currentY);
        if (boardPos) {
            this.game.updatePieceState(piece.id, { x: boardPos.x, y: boardPos.y });
            return;
        }

        // Fallback: return to dock
        const dockPos = this.findNearestDockPosition(piece, currentX, currentY);
        this.game.updatePieceState(piece.id, { x: dockPos.x, y: dockPos.y });
    }

    findNearestBoardPosition(piece, shape, fromX, fromY) {
        const boardRows = this.game.targetGrid?.length || 5;
        const boardCols = this.game.targetGrid?.[0]?.length || 5;
        // Use cached array when available
        const otherPieces = this.cachedOtherPieces || this.game.pieces.filter(p => p !== piece);

        const candidates = [];
        for (let y = 0; y < boardRows; y++) {
            for (let x = 0; x < boardCols; x++) {
                if (isValidPlacement(shape, x, y, this.game.targetGrid, otherPieces)) {
                    const dist = Math.hypot(x - fromX, y - fromY);
                    candidates.push({ x, y, dist });
                }
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => a.dist - b.dist);
        return candidates[0];
    }

    cancelDrag() {
        // Return piece to original dock position if needed
        if (this.draggingPiece) {
            const piece = this.draggingPiece;
            const dockPos = this.findNearestDockPosition(piece, piece.x, piece.y);
            this.game.updatePieceState(piece.id, { x: dockPos.x, y: dockPos.y });
        }
        this.renderer.clearGhostPreview();
        this.resetDragState();
    }

    resetDragState() {
        this.draggingPiece = null;
        this.isDragging = false;
        this.activeTouchId = null;
        this.renderer.draggingPieceId = null;
        this.renderer.dragStartGridPos = null;
        this.hasInteraction = false;
        this.dragStartGridPos = null;
        this.dragStartScreenPos = null;
        this.cachedOtherPieces = null;
        this.cachedPieceRects = null;
        clearOccupancyCache();
    }
}
