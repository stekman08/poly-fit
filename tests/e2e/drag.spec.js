import { test, expect } from '@playwright/test';

async function startGame(page) {
    await page.goto('/');
    await page.waitForSelector('#start-screen');
    await page.click('#btn-new-game');
    // Dismiss tutorial if shown
    const gotItBtn = page.locator('#btn-got-it');
    await gotItBtn.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    if (await gotItBtn.isVisible()) {
        await gotItBtn.click();
    }
    // Wait for game to be initialized
    await page.waitForFunction(() =>
        window.game &&
        window.renderer &&
        window.game.pieces.length > 0
    );
}

/**
 * Get the pixel position of a piece's first block in the dock, accounting for scale.
 * We target a specific block rather than center, since irregular shapes may have holes.
 */
async function getPiecePixelCenter(page, pieceIndex = 0) {
    return await page.evaluate((idx) => {
        const game = window.game;
        const renderer = window.renderer;
        if (!game || !renderer) return null;

        const piece = game.pieces[idx];
        if (!piece) return null;

        const shape = piece.currentShape;
        const pieceW = Math.max(...shape.map(b => b.x)) + 1;
        const pieceH = Math.max(...shape.map(b => b.y)) + 1;

        // Piece bounding box center (for scale calculation)
        const centerGridX = piece.x + pieceW / 2;
        const centerGridY = piece.y + pieceH / 2;

        // Use first block of the shape (guaranteed to exist)
        const firstBlock = shape[0];
        const blockGridX = piece.x + firstBlock.x;
        const blockGridY = piece.y + firstBlock.y;

        // Calculate scaled position of this block's center
        const DOCK_Y = 6;
        const DOCK_PIECE_SCALE = 0.5;
        const inDock = piece.y >= DOCK_Y;
        const scale = inDock ? DOCK_PIECE_SCALE : 1.0;

        // Scale block position relative to piece center
        const scaledBlockX = centerGridX + (blockGridX - centerGridX) * scale;
        const scaledBlockY = centerGridY + (blockGridY - centerGridY) * scale;

        // Target center of this scaled block
        const targetGridX = scaledBlockX + scale / 2;
        const targetGridY = scaledBlockY + scale / 2;

        // Convert to pixel coordinates
        const pixelPos = renderer.gridToPixel(targetGridX, targetGridY);

        return {
            x: pixelPos.x,
            y: pixelPos.y,
            pieceId: piece.id
        };
    }, pieceIndex);
}

async function getPiecePosition(page, pieceId) {
    return await page.evaluate((id) => {
        const piece = window.game.pieces.find(p => p.id === id);
        return piece ? { x: piece.x, y: piece.y } : null;
    }, pieceId);
}

test.describe('Drag from dock', () => {
    test('can pick up piece from dock by touching its visual center', async ({ page }) => {
        await startGame(page);

        const canvas = page.locator('#game-canvas');
        await expect(canvas).toBeVisible();

        const box = await canvas.boundingBox();
        if (!box) throw new Error("No canvas");

        // Get first piece's pixel position (accounting for dock scale)
        const pieceInfo = await getPiecePixelCenter(page, 0);
        expect(pieceInfo).not.toBeNull();

        const startX = box.x + pieceInfo.x;
        const startY = box.y + pieceInfo.y;

        // Drag upward toward board area
        const endX = startX;
        const endY = box.y + box.height * 0.3; // Upper area

        // Get position before drag
        const posBefore = await getPiecePosition(page, pieceInfo.pieceId);

        // Use touch events (hasTouch device)
        // Touch start
        await canvas.dispatchEvent('touchstart', {
            touches: [{ clientX: startX, clientY: startY, identifier: 0 }],
            changedTouches: [{ clientX: startX, clientY: startY, identifier: 0 }]
        });

        // Touch move (multiple steps)
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentY = startY + (endY - startY) * progress;
            await canvas.dispatchEvent('touchmove', {
                touches: [{ clientX: startX, clientY: currentY, identifier: 0 }],
                changedTouches: [{ clientX: startX, clientY: currentY, identifier: 0 }]
            });
        }

        // Check position DURING drag (before touch end)
        const posDuring = await getPiecePosition(page, pieceInfo.pieceId);

        // Touch end
        await canvas.dispatchEvent('touchend', {
            touches: [],
            changedTouches: [{ clientX: endX, clientY: endY, identifier: 0 }]
        });

        // Verify piece was picked up (Y changed during drag, even if it snaps back after)
        expect(posDuring.y).toBeLessThan(posBefore.y);
    });

    test('piece returns to dock if dropped on invalid position', async ({ page }) => {
        await startGame(page);

        const canvas = page.locator('#game-canvas');
        const box = await canvas.boundingBox();
        if (!box) throw new Error("No canvas");

        const pieceInfo = await getPiecePixelCenter(page, 0);
        expect(pieceInfo).not.toBeNull();

        const startX = box.x + pieceInfo.x;
        const startY = box.y + pieceInfo.y;

        // Drag to far left (off the board - invalid position)
        const endX = box.x + 10;
        const endY = box.y + box.height / 3;

        // Use touch events
        await canvas.dispatchEvent('touchstart', {
            touches: [{ clientX: startX, clientY: startY, identifier: 0 }],
            changedTouches: [{ clientX: startX, clientY: startY, identifier: 0 }]
        });

        const steps = 10;
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;
            await canvas.dispatchEvent('touchmove', {
                touches: [{ clientX: currentX, clientY: currentY, identifier: 0 }],
                changedTouches: [{ clientX: currentX, clientY: currentY, identifier: 0 }]
            });
        }

        await canvas.dispatchEvent('touchend', {
            touches: [],
            changedTouches: [{ clientX: endX, clientY: endY, identifier: 0 }]
        });

        const posAfter = await getPiecePosition(page, pieceInfo.pieceId);

        // Piece should be back in dock (y >= 6)
        expect(posAfter.y).toBeGreaterThanOrEqual(6);
    });
});
