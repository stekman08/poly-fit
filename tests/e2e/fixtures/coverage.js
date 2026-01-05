import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coverageDir = path.join(__dirname, '../../../coverage/e2e-tmp');

// Ensure coverage directory exists
if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
}

/**
 * Extended test fixture that collects JS coverage from each test
 */
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        // Start collecting JS coverage
        await page.coverage.startJSCoverage({
            resetOnNavigation: false
        });

        // Run the test
        await use(page);

        // Stop and save coverage
        const coverage = await page.coverage.stopJSCoverage();

        // Filter to only our source files (not node_modules, etc)
        const filteredCoverage = coverage.filter(entry => {
            const url = entry.url;
            return url.includes('/js/') && !url.includes('node_modules');
        });

        if (filteredCoverage.length > 0) {
            // Create unique filename for this test
            const testId = testInfo.testId.replace(/[^a-zA-Z0-9]/g, '_');
            const coverageFile = path.join(coverageDir, `coverage-${testId}.json`);
            fs.writeFileSync(coverageFile, JSON.stringify(filteredCoverage, null, 2));
        }
    }
});

export { expect } from '@playwright/test';
