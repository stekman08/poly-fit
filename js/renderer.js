import { COLORS, getShapeDimensions } from './shapes.js';
import { ConfettiSystem } from './effects/Confetti.js';
import { DOCK_Y, DOCK_PIECE_SCALE, GHOST_ALPHA } from './config/constants.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.gridSize = 40; // Default, will resize

        // Visual configuration
        this.offsetX = 0; // Board centering
        this.offsetY = 0;

        // Effects
        this.confetti = new ConfettiSystem();

        // Ghost preview for dragging
        this.ghostPreview = null;

        // Currently dragging piece (set by InputHandler)
        this.draggingPieceId = null;

        // Resize observer
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Vertical Layout Requirements:
        // Board: 5 blocks
        // Gap: 1 block
        // Dock: 8 blocks (more rows for scaled pieces)
        // Top/Bottom Padding: ~2 blocks equivalent
        const totalGridHeight = 5 + 1 + 8 + 2; // = 16 (was 14)

        // Horizontal:
        // Board 5 blocks + Padding
        const totalGridWidth = 7;

        const maxCellH = this.height / totalGridHeight;
        const maxCellW = this.width / totalGridWidth;

        // Pick the smaller to ensure fit
        this.gridSize = Math.floor(Math.min(maxCellH, maxCellW));

        // Center Horizontally
        this.offsetX = (this.width - (5 * this.gridSize)) / 2;

        // Position board below header with some padding
        this.offsetY = this.gridSize * 2.5;
    }

    // Convert Screen Pixels to Grid Coords (can be fractional)
    pixelToGrid(px, py) {
        return {
            x: (px - this.offsetX) / this.gridSize,
            y: (py - this.offsetY) / this.gridSize
        };
    }

    // Convert Grid Coords to Screen Pixels
    gridToPixel(gx, gy) {
        return {
            x: this.offsetX + gx * this.gridSize,
            y: this.offsetY + gy * this.gridSize
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    draw(game) {
        this.clear();
        this.drawTargetGrid(game.targetGrid);

        // Draw hint if active
        if (this.hintData) {
            this.drawHint(this.hintData);
        }

        // Draw ghost preview if dragging
        if (this.ghostPreview) {
            this.drawGhostPreview(this.ghostPreview);
        }

        game.pieces.forEach(p => {
            const isDragging = p.id === this.draggingPieceId;
            this.drawPiece(p, isDragging);
        });

        // Update and draw effects
        this.confetti.update();
        this.confetti.draw(this.ctx);
    }

    showHint(hintData) {
        this.hintData = hintData;
    }

    hideHint() {
        this.hintData = null;
    }

    setGhostPreview(shape, x, y, color, isValid = true) {
        this.ghostPreview = { shape, x, y, color, isValid };
    }

    clearGhostPreview() {
        this.ghostPreview = null;
    }

    drawHint(hint) {
        const { x, y, shape, color } = hint;

        this.ctx.save();

        // Pulsing glow effect
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.5;
        this.ctx.globalAlpha = pulse;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 20;

        shape.forEach(block => {
            const pos = this.gridToPixel(x + block.x, y + block.y);
            const margin = 4;
            const size = this.gridSize - (margin * 2);
            this.ctx.strokeRect(pos.x + margin, pos.y + margin, size, size);
        });

        this.ctx.restore();
    }

    drawGhostPreview(ghost) {
        const { x, y, shape, color, isValid } = ghost;

        this.ctx.save();

        if (isValid) {
            // Valid placement: solid ghost with piece color
            this.ctx.globalAlpha = GHOST_ALPHA;
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = color;
            this.ctx.setLineDash([4, 4]);
        } else {
            // Invalid placement: dimmed, no fill, just outline
            this.ctx.globalAlpha = 0.2;
            this.ctx.fillStyle = 'transparent';
            this.ctx.strokeStyle = '#888';
            this.ctx.setLineDash([2, 4]);
        }
        this.ctx.lineWidth = 2;

        shape.forEach(block => {
            const pos = this.gridToPixel(x + block.x, y + block.y);
            const margin = 4;
            const size = this.gridSize - (margin * 2);
            if (isValid) {
                this.ctx.fillRect(pos.x + margin, pos.y + margin, size, size);
            }
            this.ctx.strokeRect(pos.x + margin, pos.y + margin, size, size);
        });

        this.ctx.restore();
    }

    triggerWinEffect() {
        // Burst confetti from center of the board
        const centerX = this.offsetX + (2.5 * this.gridSize);
        const centerY = this.offsetY + (2.5 * this.gridSize);
        this.confetti.burst(centerX, centerY, 100);
    }

    clearEffects() {
        this.confetti.clear();
    }

    drawTargetGrid(grid) {
        if (!grid || grid.length === 0 || !grid[0]) return;
        const rows = grid.length;
        const cols = grid[0].length;

        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;

        // Draw grid slots
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] === 1) { // It's a valid target spot
                    const pos = this.gridToPixel(c, r);

                    // Draw visible pit with darker teal fill
                    this.ctx.fillStyle = 'rgba(0, 60, 70, 0.8)';
                    this.ctx.fillRect(pos.x, pos.y, this.gridSize, this.gridSize);

                    this.ctx.shadowColor = '#00ffff';
                    this.ctx.shadowBlur = 10;
                    this.ctx.strokeRect(pos.x, pos.y, this.gridSize, this.gridSize);
                    this.ctx.shadowBlur = 0;
                }
            }
        }
        this.ctx.restore();
    }

    drawPiece(piece, isDragging = false) {
        const shape = piece.currentShape;
        const color = piece.color || COLORS[0];
        const inDock = piece.y >= DOCK_Y;
        const onBoard = !inDock && !isDragging;

        this.ctx.save();

        const pos = this.gridToPixel(piece.x, piece.y);
        let x = pos.x;
        let y = pos.y;

        // Determine scale and effects based on state
        // Pieces are small (50%) in dock AND while dragging
        // Only full size when placed on board
        let scale = 1.0;

        if (onBoard) {
            // On board: full size
            scale = 1.0;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 5;
            this.ctx.globalAlpha = 0.9;
        } else if (isDragging) {
            // Dragging: stay small, strong glow
            scale = DOCK_PIECE_SCALE;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 15;
            this.ctx.globalAlpha = 0.95;
        } else {
            // In dock (not dragging): small
            scale = DOCK_PIECE_SCALE;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 5;
            this.ctx.globalAlpha = 0.85;
        }

        // Apply scaling transform (centered on piece)
        if (scale !== 1.0) {
            const dims = getShapeDimensions(shape);
            const pieceWidth = dims.width * this.gridSize;
            const pieceHeight = dims.height * this.gridSize;
            const centerX = x + pieceWidth / 2;
            const centerY = y + pieceHeight / 2;

            this.ctx.translate(centerX, centerY);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-centerX, -centerY);
        }

        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;

        shape.forEach(block => {
            const bx = x + block.x * this.gridSize;
            const by = y + block.y * this.gridSize;

            // Draw block with small margin for "mosaic" look
            const margin = 4;
            const size = this.gridSize - (margin * 2);

            this.ctx.fillRect(bx + margin, by + margin, size, size);
            this.ctx.strokeRect(bx + margin, by + margin, size, size);

            // Inner glossy highlight
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctx.fillRect(bx + margin, by + margin, size, size / 2);
            this.ctx.fillStyle = color; // reset
        });

        this.ctx.restore();
    }
}
