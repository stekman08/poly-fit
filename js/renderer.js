import { COLORS, getShapeDimensions } from './shapes.js';
import { ConfettiSystem } from './effects/Confetti.js';
import { getDockY } from './config/constants.js';

/**
 * Find all cells that should be displayed as visual holes.
 * A visual hole is a connected region of empty cells (value=0) that is
 * completely surrounded by target cells (value=1).
 * Board edges do NOT count as walls - only targets count.
 */
function findVisualHoles(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const visited = new Set();
    const visualHoles = new Set();

    const key = (r, c) => `${r},${c}`;

    // Flood-fill to find connected region of empty cells
    function getRegion(startR, startC) {
        const region = [];
        const stack = [[startR, startC]];

        while (stack.length > 0) {
            const [r, c] = stack.pop();
            const k = key(r, c);

            if (visited.has(k)) continue;
            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            if (grid[r][c] !== 0) continue;

            visited.add(k);
            region.push([r, c]);

            stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
        }

        return region;
    }

    // Check if a region is completely surrounded by targets
    function isRegionSurrounded(region) {
        const regionSet = new Set(region.map(([r, c]) => key(r, c)));

        for (const [r, c] of region) {
            const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];

            for (const [nr, nc] of neighbors) {
                const nk = key(nr, nc);
                if (regionSet.has(nk)) continue; // Same region, skip

                // Check if neighbor is outside grid (board edge = not surrounded)
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    return false;
                }

                // Neighbor must be a target (value=1) to be "surrounded"
                if (grid[nr][nc] !== 1) {
                    return false;
                }
            }
        }

        return true;
    }

    // Find all regions and check if they're surrounded
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === 0 && !visited.has(key(r, c))) {
                const region = getRegion(r, c);
                if (region.length > 0 && isRegionSurrounded(region)) {
                    for (const [rr, rc] of region) {
                        visualHoles.add(key(rr, rc));
                    }
                }
            }
        }
    }

    return visualHoles;
}

/**
 * DOM-based Renderer - replaces Canvas rendering with CSS Grid
 * Benefits: automatic responsiveness, native touch handling, easier styling
 */
export class Renderer {
    constructor() {
        this.boardEl = document.getElementById('game-board');
        this.dockEl = document.getElementById('piece-dock');
        this.effectsCanvas = document.getElementById('effects-canvas');
        this.effectsCtx = this.effectsCanvas?.getContext('2d');

        this.boardRows = 5;
        this.boardCols = 5;
        this.cellSize = 50;

        this.pieceElements = new Map();
        this.ghostEl = null;
        this.hintEl = null;
        this.confetti = new ConfettiSystem();
        this.lastGridState = null;

        this.draggingPieceId = null;
        this.dragStartGridPos = null;

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    setBoardSize(rows, cols) {
        if (this.boardRows !== rows || this.boardCols !== cols) {
            this.boardRows = rows;
            this.boardCols = cols;
            this.resize();
        }
    }

    resize() {
        this.boardEl.style.setProperty('--rows', this.boardRows);
        this.boardEl.style.setProperty('--cols', this.boardCols);

        // Target ~40px cells, constrained by container
        const containerWidth = Math.min(window.innerWidth, 600) - 40;
        const containerHeight = window.innerHeight * 0.30;
        const maxCellSize = 40;
        this.cellSize = Math.floor(Math.min(
            containerWidth / this.boardCols,
            containerHeight / this.boardRows,
            maxCellSize
        ));

        this.boardEl.parentElement.style.setProperty('--cell-size', `${this.cellSize}px`);

        if (this.effectsCanvas) {
            this.effectsCanvas.width = window.innerWidth;
            this.effectsCanvas.height = window.innerHeight;
        }
    }

    getBoardRect() {
        return this.boardEl.getBoundingClientRect();
    }

    pixelToGrid(px, py) {
        const rect = this.getBoardRect();
        return {
            x: (px - rect.left) / this.cellSize,
            y: (py - rect.top) / this.cellSize
        };
    }

    get gridSize() {
        return this.cellSize;
    }

    // Check if confetti animation is active (for render loop optimization)
    isConfettiActive() {
        return this.confetti.isActive;
    }

    // Main draw function - updates DOM elements
    // confettiActive param tells us if we need to update canvas (optimization)
    draw(game, confettiActive = false) {
        this.updateBoard(game.targetGrid);
        this.updatePieces(game.pieces);

        // Only update confetti canvas when particles are active
        if (confettiActive && this.effectsCtx && this.effectsCanvas) {
            this.effectsCtx.clearRect(0, 0, this.effectsCanvas.width, this.effectsCanvas.height);
            this.confetti.update();
            this.confetti.draw(this.effectsCtx);
        }
    }

    // Create/update board grid cells
    updateBoard(grid) {
        if (!grid || grid.length === 0) return;

        const rows = grid.length;
        const cols = grid[0].length;

        // Only recreate if dimensions changed
        const currentCells = this.boardEl.querySelectorAll('.board-cell').length;
        const needsRebuild = currentCells !== rows * cols;

        if (needsRebuild) {
            this.boardEl.innerHTML = '';
            this.lastGridState = null; // Force cell state update after rebuild

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'board-cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    this.boardEl.appendChild(cell);
                }
            }
        }

        // Skip cell state updates if grid hasn't changed
        // (Grid is static during gameplay - only changes on new level)
        if (this.lastGridState === grid) {
            return;
        }
        this.lastGridState = grid;

        // Update cell states (only runs once per level)
        const cells = this.boardEl.querySelectorAll('.board-cell');
        const visualHoles = findVisualHoles(grid);

        let i = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = cells[i++];
                const value = grid[r][c];

                cell.classList.toggle('target', value === 1);

                const isVisualHole = visualHoles.has(`${r},${c}`);

                cell.classList.toggle('hole', value === -1 || isVisualHole);
                cell.classList.toggle('outside', value === -2 || (value === 0 && !isVisualHole));
            }
        }
    }

    // Create/update piece elements
    updatePieces(pieces) {
        const dockY = getDockY(this.boardRows);

        pieces.forEach(piece => {
            let el = this.pieceElements.get(piece.id);

            // Create piece element if needed
            if (!el) {
                el = this.createPieceElement(piece);
                this.pieceElements.set(piece.id, el);
            }

            // Determine state early for caching
            const isDragging = piece.id === this.draggingPieceId;

            // Fast path: skip ALL DOM operations if piece state unchanged
            // During drag, only the dragged piece's x/y changes - other pieces can skip entirely
            const stateKey = `${piece.x}:${piece.y}:${piece.rotation}:${piece.flipped}:${isDragging}`;
            if (el.dataset.stateKey === stateKey) {
                return; // Nothing changed, skip all DOM operations
            }
            el.dataset.stateKey = stateKey;

            // Update piece shape and color (has its own cache)
            this.updatePieceShape(el, piece);

            const inDock = piece.y >= dockY;
            const onBoard = !inDock && !isDragging;

            // Check if we're about to START dragging from dock
            // IMPORTANT: Capture DOM position BEFORE applying .dragging class,
            // because .dragging CSS changes left/top which affects getBoundingClientRect()
            const isInBoard = el.parentElement === this.boardEl;
            const justStartingDockDrag = isDragging &&
                                         !isInBoard &&
                                         el.style.position !== 'fixed';

            let dockDragOrigin = null;
            if (justStartingDockDrag) {
                // Capture current DOM position while still position:relative in dock
                dockDragOrigin = el.getBoundingClientRect();
            }

            // Update classes
            el.classList.toggle('in-dock', inDock && !isDragging);
            el.classList.toggle('on-board', onBoard);
            el.classList.toggle('dragging', isDragging);

            // Position piece using CSS custom properties for cleaner DOM-based rendering
            el.style.setProperty('--piece-x', piece.x);
            el.style.setProperty('--piece-y', piece.y);

            if (onBoard) {
                // On board: CSS handles positioning via custom properties
                el.style.position = 'absolute';
                el.style.zIndex = '';

                if (el.parentElement !== this.boardEl) {
                    this.boardEl.appendChild(el);
                }
            } else if (isDragging) {
                // Dragging: use fixed position
                // IMPORTANT: Do NOT reparent the element - moving it in the DOM during
                // a touch gesture breaks touch event tracking.
                if (isInBoard) {
                    // CSS quirk: #game-board has a filter property, which creates a new
                    // containing block for position:fixed children. So position:fixed
                    // is relative to board, not viewport - no offset needed.
                    el.style.setProperty('--board-left', '0px');
                    el.style.setProperty('--board-top', '0px');
                } else if (dockDragOrigin) {
                    // Starting drag from dock: use captured DOM position to calculate offset
                    // The CSS calc is: left = board-left + piece-x * cellSize
                    // We want: left = originalDOMLeft when piece-x equals original value
                    // Use dragStartGridPos (the original position before drag started)
                    const origX = this.dragStartGridPos?.x ?? piece.x;
                    const origY = this.dragStartGridPos?.y ?? piece.y;
                    const baseLeft = dockDragOrigin.left - origX * this.cellSize;
                    const baseTop = dockDragOrigin.top - origY * this.cellSize;
                    el.style.setProperty('--board-left', `${baseLeft}px`);
                    el.style.setProperty('--board-top', `${baseTop}px`);
                }
                // If already dragging from dock, keep the stored offset
                el.style.position = 'fixed';
                el.style.zIndex = '1000';
            } else {
                // In dock: relative positioning handled by flexbox
                el.style.position = 'relative';
                el.style.zIndex = '';

                if (el.parentElement !== this.dockEl) {
                    this.dockEl.appendChild(el);
                }
            }
        });

        // Remove orphaned piece elements (O(n) using Set instead of O(n*m) with find)
        const currentPieceIds = new Set(pieces.map(p => p.id));
        for (const [id, el] of this.pieceElements) {
            if (!currentPieceIds.has(id)) {
                el.remove();
                this.pieceElements.delete(id);
            }
        }
    }

    createPieceElement(piece) {
        const el = document.createElement('div');
        el.className = 'piece';
        el.dataset.pieceId = piece.id;
        el.style.color = piece.color || COLORS[0];
        return el;
    }

    updatePieceShape(el, piece) {
        // Fast cache check FIRST - rotation+flipped uniquely determine currentShape
        // This avoids expensive map/sort/join and style writes on every frame
        const color = piece.color || COLORS[0];
        const cacheKey = `${piece.id}:${piece.rotation}:${piece.flipped}:${color}`;
        if (el.dataset.cacheKey === cacheKey) {
            return; // Nothing changed, skip ALL expensive operations
        }
        el.dataset.cacheKey = cacheKey;

        // Only calculate dimensions and update styles when shape actually changed
        const shape = piece.currentShape;
        const dims = getShapeDimensions(shape);

        // Update grid template - no gap to match board cells exactly
        el.style.display = 'grid';
        el.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
        el.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
        el.style.width = `calc(var(--cell-size) * ${dims.width})`;
        el.style.height = `calc(var(--cell-size) * ${dims.height})`;
        el.style.color = color;

        // Clear and rebuild blocks
        el.innerHTML = '';

        // Create a grid of the shape
        for (let y = 0; y < dims.height; y++) {
            for (let x = 0; x < dims.width; x++) {
                const hasBlock = shape.some(b => b.x === x && b.y === y);

                if (hasBlock) {
                    const block = document.createElement('div');
                    block.className = 'piece-block';
                    block.style.setProperty('--piece-color', color);
                    el.appendChild(block);
                } else {
                    // Empty spacer for grid alignment - must be completely invisible
                    const spacer = document.createElement('div');
                    spacer.style.background = 'transparent';
                    spacer.style.border = 'none';
                    spacer.style.visibility = 'hidden';
                    el.appendChild(spacer);
                }
            }
        }
    }

    // Ghost preview for drag placement
    setGhostPreview(shape, x, y, color, isValid = true) {
        if (!this.ghostEl) {
            this.ghostEl = document.createElement('div');
            this.ghostEl.className = 'ghost-preview';
            this.boardEl.appendChild(this.ghostEl);
        }

        const dims = getShapeDimensions(shape);
        const shapeSignature = `${dims.width}x${dims.height}:${shape.map(b => `${b.x},${b.y}`).sort().join(';')}:${color}`;

        // Only rebuild DOM if shape changed
        if (this.ghostEl.dataset.shapeSignature !== shapeSignature) {
            this.ghostEl.dataset.shapeSignature = shapeSignature;
            this.ghostEl.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
            this.ghostEl.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
            this.ghostEl.style.color = color;

            this.ghostEl.innerHTML = '';
            for (let py = 0; py < dims.height; py++) {
                for (let px = 0; px < dims.width; px++) {
                    const hasBlock = shape.some(b => b.x === px && b.y === py);
                    if (hasBlock) {
                        const block = document.createElement('div');
                        block.className = 'piece-block';
                        this.ghostEl.appendChild(block);
                    } else {
                        const spacer = document.createElement('div');
                        spacer.style.visibility = 'hidden';
                        this.ghostEl.appendChild(spacer);
                    }
                }
            }
        }

        // Always update position and validity state
        this.ghostEl.style.left = `${x * this.cellSize}px`;
        this.ghostEl.style.top = `${y * this.cellSize}px`;
        this.ghostEl.style.opacity = isValid ? '0.4' : '0.2';
        this.ghostEl.style.display = 'grid';
    }

    clearGhostPreview() {
        if (this.ghostEl) {
            this.ghostEl.style.display = 'none';
            delete this.ghostEl.dataset.shapeSignature;
        }
    }

    // Hint display
    showHint(hintData) {
        const { x, y, shape, color } = hintData;

        if (!this.hintEl) {
            this.hintEl = document.createElement('div');
            this.hintEl.className = 'hint-overlay';
            this.boardEl.appendChild(this.hintEl);
        }

        const dims = getShapeDimensions(shape);
        this.hintEl.style.gridTemplateColumns = `repeat(${dims.width}, var(--cell-size))`;
        this.hintEl.style.gridTemplateRows = `repeat(${dims.height}, var(--cell-size))`;
        this.hintEl.style.color = color;
        this.hintEl.style.left = `${x * this.cellSize}px`;
        this.hintEl.style.top = `${y * this.cellSize}px`;

        // Rebuild blocks
        this.hintEl.innerHTML = '';
        for (let py = 0; py < dims.height; py++) {
            for (let px = 0; px < dims.width; px++) {
                const hasBlock = shape.some(b => b.x === px && b.y === py);
                if (hasBlock) {
                    const block = document.createElement('div');
                    block.className = 'piece-block';
                    this.hintEl.appendChild(block);
                } else {
                    const spacer = document.createElement('div');
                    spacer.style.background = 'transparent';
                    spacer.style.border = 'none';
                    spacer.style.visibility = 'hidden';
                    this.hintEl.appendChild(spacer);
                }
            }
        }

        this.hintEl.style.display = 'grid';
    }

    hideHint() {
        if (this.hintEl) {
            this.hintEl.style.display = 'none';
        }
    }

    // Effects
    triggerWinEffect() {
        if (this.effectsCanvas) {
            const rect = this.boardEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            this.confetti.burst(centerX, centerY, 100);
        }
    }

    clearEffects() {
        this.confetti.clear();
        this.lastGridState = null; // Reset cache for new level
        if (this.effectsCtx) {
            this.effectsCtx.clearRect(0, 0, this.effectsCanvas.width, this.effectsCanvas.height);
        }
    }

    // Get piece element by ID (for input handler)
    getPieceElement(pieceId) {
        return this.pieceElements.get(pieceId);
    }
}
