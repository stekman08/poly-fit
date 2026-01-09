import { test, expect } from './fixtures/coverage.js';

async function startAtLevel(page, level) {
    await page.goto('/');
    await page.evaluate((lvl) => {
        localStorage.setItem('polyfit-max-level', String(lvl));
        localStorage.setItem('polyfit-tutorial-shown', '3');
    }, level);
    await page.reload();
    await page.waitForSelector('#start-screen');
    await page.click('#btn-continue');
    await page.waitForFunction(() => document.querySelector('#start-screen').classList.contains('hidden'));
    await page.waitForFunction(() =>
        window.game &&
        window.game.targetGrid &&
        window.game.pieces.length > 0 &&
        document.querySelectorAll('.piece').length > 0
    );
}

async function getSolution(page) {
    return await page.evaluate(() => {
        return window.game.pieces.map(p => ({
            id: p.id,
            x: p.solutionX,
            y: p.solutionY,
            rotation: p.effectiveRotation,
            flipped: p.effectiveFlipped
        }));
    });
}

async function placePieceOnBoard(page, piece) {
    await page.evaluate((p) => {
        const game = window.game;
        game.updatePieceState(p.id, {
            x: p.x,
            y: p.y,
            rotation: p.rotation,
            flipped: p.flipped
        });
    }, piece);
}

test.describe('Drag Performance Measurement', () => {
    test('measure frame times during drag on level 360 (7 pieces)', async ({ page }) => {
        await startAtLevel(page, 360);

        const pieces = await page.evaluate(() => window.game.pieces.length);
        console.log(`\nLevel 360: ${pieces} pieces`);

        // Inject frame time measurement
        await page.evaluate(() => {
            window.frameTimes = [];
            window.lastFrameTime = performance.now();
            window.frameObserver = () => {
                const now = performance.now();
                window.frameTimes.push(now - window.lastFrameTime);
                window.lastFrameTime = now;
                if (window.frameTimes.length < 200) {
                    requestAnimationFrame(window.frameObserver);
                }
            };
            requestAnimationFrame(window.frameObserver);
        });

        // Get first piece from dock
        const pieceSelector = '#piece-dock .piece';
        await page.waitForSelector(pieceSelector);
        const pieceBox = await page.locator(pieceSelector).first().boundingBox();
        const boardBox = await page.locator('#game-board').boundingBox();

        // Perform slow drag
        const startX = pieceBox.x + pieceBox.width / 2;
        const startY = pieceBox.y + pieceBox.height / 2;
        const endX = boardBox.x + boardBox.width / 2;
        const endY = boardBox.y + boardBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();

        // Drag in small steps (simulates ~60fps movement)
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;
            await page.mouse.move(x, y);
            await page.waitForTimeout(16);
        }

        await page.mouse.up();

        // Collect frame time stats
        const stats = await page.evaluate(() => {
            const times = window.frameTimes.filter(t => t > 0 && t < 200); // Filter outliers
            if (times.length === 0) return null;

            times.sort((a, b) => a - b);
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            return {
                count: times.length,
                avg: avg.toFixed(2),
                min: times[0].toFixed(2),
                max: times[times.length - 1].toFixed(2),
                p50: times[Math.floor(times.length * 0.5)].toFixed(2),
                p95: times[Math.floor(times.length * 0.95)].toFixed(2),
                p99: times[Math.floor(times.length * 0.99)].toFixed(2),
                fps: (1000 / avg).toFixed(1),
                slow: times.filter(t => t > 33.3).length
            };
        });

        console.log('\n=== DRAG PERFORMANCE RESULTS ===');
        console.log(`Frames: ${stats.count}`);
        console.log(`Avg frame time: ${stats.avg}ms (${stats.fps} FPS)`);
        console.log(`Min/Max: ${stats.min}ms / ${stats.max}ms`);
        console.log(`P50: ${stats.p50}ms, P95: ${stats.p95}ms, P99: ${stats.p99}ms`);
        console.log(`Slow frames (>33.3ms): ${stats.slow}`);
        console.log('================================\n');

        // Performance assertion: average should be under 20ms (50fps minimum)
        // Note: CSS improvements (blur, animations) show more on real mobile GPU
        expect(parseFloat(stats.avg)).toBeLessThan(20);
    });

    test('count DOM operations during drag', async ({ page }) => {
        await startAtLevel(page, 360);

        // Inject DOM operation counter
        await page.evaluate(() => {
            window.domOpCount = 0;
            const origSet = CSSStyleDeclaration.prototype.setProperty;
            CSSStyleDeclaration.prototype.setProperty = function(...args) {
                window.domOpCount++;
                return origSet.apply(this, args);
            };
        });

        // Reset counter
        await page.evaluate(() => { window.domOpCount = 0; });

        // Get first piece from dock
        const pieceBox = await page.locator('#piece-dock .piece').first().boundingBox();

        await page.mouse.move(pieceBox.x + 20, pieceBox.y + 20);
        await page.mouse.down();

        // 30 drag steps
        for (let i = 0; i <= 30; i++) {
            await page.mouse.move(pieceBox.x + 20 + i * 5, pieceBox.y + 20);
            await page.waitForTimeout(16);
        }

        await page.mouse.up();

        const domOps = await page.evaluate(() => window.domOpCount);
        const opsPerFrame = domOps / 30;

        console.log(`\nDOM setProperty calls: ${domOps}`);
        console.log(`Per frame (30 frames): ${opsPerFrame.toFixed(1)} ops/frame`);
        console.log(`Expected with fix: ~7 ops/frame (1 piece × 7 properties)`);
        console.log(`Without fix would be: ~49 ops/frame (7 pieces × 7 properties)\n`);

        // With optimization: should be under 5 ops/frame
        // Strict threshold to verify minimal DOM operations
        expect(opsPerFrame).toBeLessThan(5);
    });
});
