import { test, expect } from '@playwright/test';

/**
 * Test if touch-action CSS property affects CDP touch event delivery
 */

test.describe('touch-action CSS effect on touch events', () => {

    test('CDP touchmove with touch-action: none vs auto', async ({ page }) => {
        // Create a minimal test page
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { margin: 0; padding: 20px; }
                    .test-box {
                        width: 200px;
                        height: 200px;
                        background: blue;
                        margin: 20px;
                    }
                    .touch-action-none { touch-action: none; }
                    .touch-action-auto { touch-action: auto; }
                </style>
            </head>
            <body>
                <div id="box-none" class="test-box touch-action-none">touch-action: none</div>
                <div id="box-auto" class="test-box touch-action-auto">touch-action: auto</div>
            </body>
            </html>
        `);

        // Add event listeners
        await page.evaluate(() => {
            window.__events = { none: [], auto: [] };

            ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                document.getElementById('box-none').addEventListener(type, (e) => {
                    window.__events.none.push(type);
                }, { passive: true });

                document.getElementById('box-auto').addEventListener(type, (e) => {
                    window.__events.auto.push(type);
                }, { passive: true });

                // Also on window
                window.addEventListener(type, (e) => {
                    // Identify which box based on target
                    if (e.target.id === 'box-none') {
                        window.__events.none.push(`window:${type}`);
                    } else if (e.target.id === 'box-auto') {
                        window.__events.auto.push(`window:${type}`);
                    }
                }, { passive: true });
            });
        });

        const client = await page.context().newCDPSession(page);

        // Test box with touch-action: none
        const boxNone = await page.locator('#box-none').boundingBox();
        const centerNoneX = boxNone.x + boxNone.width / 2;
        const centerNoneY = boxNone.y + boxNone.height / 2;

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: centerNoneX, y: centerNoneY, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: centerNoneX, y: centerNoneY - 50, id: 1 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(30);

        // Test box with touch-action: auto
        const boxAuto = await page.locator('#box-auto').boundingBox();
        const centerAutoX = boxAuto.x + boxAuto.width / 2;
        const centerAutoY = boxAuto.y + boxAuto.height / 2;

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: centerAutoX, y: centerAutoY, id: 2 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: centerAutoX, y: centerAutoY - 50, id: 2 }]
        });
        await page.waitForTimeout(30);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await page.waitForTimeout(30);

        const events = await page.evaluate(() => window.__events);
        console.log('Events for touch-action: none:', events.none);
        console.log('Events for touch-action: auto:', events.auto);

        // Check what we got
        const noneHasTouchstart = events.none.includes('touchstart');
        const noneHasTouchmove = events.none.includes('touchmove');
        const autoHasTouchstart = events.auto.includes('touchstart');
        const autoHasTouchmove = events.auto.includes('touchmove');

        console.log('none: touchstart =', noneHasTouchstart, ', touchmove =', noneHasTouchmove);
        console.log('auto: touchstart =', autoHasTouchstart, ', touchmove =', autoHasTouchmove);
    });

    test('Playwright touchscreen vs CDP comparison', async ({ page }) => {
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { margin: 0; padding: 20px; touch-action: none; }
                    #target { width: 200px; height: 200px; background: green; touch-action: none; }
                </style>
            </head>
            <body>
                <div id="target">Drag me</div>
            </body>
            </html>
        `);

        await page.evaluate(() => {
            window.__touchEvents = [];
            ['touchstart', 'touchmove', 'touchend'].forEach(type => {
                window.addEventListener(type, () => {
                    window.__touchEvents.push(type);
                }, { passive: true, capture: true });
            });
        });

        const target = await page.locator('#target').boundingBox();
        const centerX = target.x + target.width / 2;
        const centerY = target.y + target.height / 2;

        // Method 1: Use Playwright's touchscreen.tap (simulates single tap)
        await page.touchscreen.tap(centerX, centerY);
        await page.waitForTimeout(50);

        const afterTap = await page.evaluate(() => [...window.__touchEvents]);
        console.log('After Playwright tap:', afterTap);

        // Reset
        await page.evaluate(() => { window.__touchEvents = []; });

        // Method 2: Try to do a gesture that involves movement
        // Unfortunately Playwright doesn't have a touchscreen.move() API
        // So we'll try using CDP
        const client = await page.context().newCDPSession(page);

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: centerX, y: centerY, id: 1 }]
        });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: centerX + 50, y: centerY, id: 1 }]
        });

        await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });

        await page.waitForTimeout(50);

        const afterCDP = await page.evaluate(() => [...window.__touchEvents]);
        console.log('After CDP touch gesture:', afterCDP);

        // Compare
        console.log('Tap generated touchstart:', afterTap.includes('touchstart'));
        console.log('Tap generated touchend:', afterTap.includes('touchend'));
        console.log('CDP generated touchstart:', afterCDP.includes('touchstart'));
        console.log('CDP generated touchmove:', afterCDP.includes('touchmove'));
    });
});
