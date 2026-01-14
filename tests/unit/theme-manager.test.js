import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createThemeManager } from '../../js/theme-manager.js';

// Mock storage module
vi.mock('../../js/storage.js', () => ({
    safeGetItem: vi.fn(),
    safeSetItem: vi.fn()
}));

import { safeGetItem, safeSetItem } from '../../js/storage.js';

describe('theme-manager', () => {
    let mockSetProperty;

    beforeEach(() => {
        // Mock document.documentElement.style.setProperty
        mockSetProperty = vi.fn();
        vi.stubGlobal('document', {
            documentElement: {
                style: {
                    setProperty: mockSetProperty
                }
            }
        });

        // Reset mocks
        vi.mocked(safeGetItem).mockReset();
        vi.mocked(safeSetItem).mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('load', () => {
        it('does nothing when no saved theme exists', () => {
            vi.mocked(safeGetItem).mockReturnValue(null);

            const manager = createThemeManager();
            manager.load();

            expect(safeGetItem).toHaveBeenCalledWith('polyfit-theme');
            expect(mockSetProperty).not.toHaveBeenCalled();
            expect(manager.getCurrentIndex()).toBe(0);
        });

        it('loads saved theme and applies it', () => {
            vi.mocked(safeGetItem).mockReturnValue('magenta');

            const manager = createThemeManager();
            manager.load();

            expect(manager.getCurrentIndex()).toBe(1);
            expect(manager.getCurrentTheme().name).toBe('magenta');
            expect(mockSetProperty).toHaveBeenCalledWith('--neon-blue', '#F92672');
        });

        it('ignores invalid saved theme name', () => {
            vi.mocked(safeGetItem).mockReturnValue('invalid-theme');

            const manager = createThemeManager();
            manager.load();

            expect(manager.getCurrentIndex()).toBe(0);
            expect(mockSetProperty).not.toHaveBeenCalled();
        });
    });

    describe('cycle', () => {
        it('cycles from first to second theme', () => {
            const manager = createThemeManager();

            manager.cycle();

            expect(manager.getCurrentIndex()).toBe(1);
            expect(manager.getCurrentTheme().name).toBe('magenta');
            expect(mockSetProperty).toHaveBeenCalledWith('--neon-blue', '#F92672');
            expect(safeSetItem).toHaveBeenCalledWith('polyfit-theme', 'magenta');
        });

        it('cycles through all themes and wraps around', () => {
            const manager = createThemeManager();

            manager.cycle(); // -> magenta (1)
            manager.cycle(); // -> green (2)
            manager.cycle(); // -> orange (3)
            manager.cycle(); // -> cyan (0)

            expect(manager.getCurrentIndex()).toBe(0);
            expect(manager.getCurrentTheme().name).toBe('cyan');
        });

        it('calls haptics.vibrateRotate when haptics provided', () => {
            const mockHaptics = {
                vibrateRotate: vi.fn()
            };
            const manager = createThemeManager({ haptics: mockHaptics });

            manager.cycle();

            expect(mockHaptics.vibrateRotate).toHaveBeenCalledOnce();
        });
    });

    describe('integration', () => {
        it('load then cycle works correctly', () => {
            vi.mocked(safeGetItem).mockReturnValue('green');

            const manager = createThemeManager();
            manager.load();

            expect(manager.getCurrentIndex()).toBe(2);

            manager.cycle();
            expect(manager.getCurrentIndex()).toBe(3);
            expect(manager.getCurrentTheme().name).toBe('orange');
        });
    });
});
