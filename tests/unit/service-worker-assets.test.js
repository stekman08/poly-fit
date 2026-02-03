import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Service worker assets', () => {
    it('includes runtime module dependencies', () => {
        // Arrange
        const sw = readFileSync(resolve('sw.js'), 'utf8');

        // Act
        const assets = [
            './js/cheat-code.js',
            './js/storage.js',
            './js/theme-manager.js',
            './js/worker-manager.js'
        ];

        // Assert
        assets.forEach((asset) => {
            expect(sw).toContain(asset);
        });
    });
});
