import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeGetItem, safeSetItem } from '../../js/storage.js';

describe('storage', () => {
    let originalLocalStorage;

    beforeEach(() => {
        // Save original localStorage
        originalLocalStorage = global.localStorage;
    });

    afterEach(() => {
        // Restore original localStorage
        global.localStorage = originalLocalStorage;
        vi.restoreAllMocks();
    });

    describe('safeGetItem', () => {
        it('returns the stored value when key exists', () => {
            const mockStorage = {
                getItem: vi.fn().mockReturnValue('stored-value')
            };
            global.localStorage = mockStorage;

            const result = safeGetItem('test-key');

            expect(mockStorage.getItem).toHaveBeenCalledWith('test-key');
            expect(result).toBe('stored-value');
        });

        it('returns null when key does not exist and no default provided', () => {
            const mockStorage = {
                getItem: vi.fn().mockReturnValue(null)
            };
            global.localStorage = mockStorage;

            const result = safeGetItem('missing-key');

            expect(result).toBeNull();
        });

        it('returns defaultValue when key does not exist', () => {
            const mockStorage = {
                getItem: vi.fn().mockReturnValue(null)
            };
            global.localStorage = mockStorage;

            const result = safeGetItem('missing-key', 'default');

            expect(result).toBe('default');
        });

        it('returns defaultValue when localStorage throws an error', () => {
            const mockStorage = {
                getItem: vi.fn().mockImplementation(() => {
                    throw new Error('Storage disabled');
                })
            };
            global.localStorage = mockStorage;

            const result = safeGetItem('any-key', 'fallback');

            expect(result).toBe('fallback');
        });

        it('returns null when localStorage throws and no default provided', () => {
            const mockStorage = {
                getItem: vi.fn().mockImplementation(() => {
                    throw new Error('Private browsing');
                })
            };
            global.localStorage = mockStorage;

            const result = safeGetItem('any-key');

            expect(result).toBeNull();
        });
    });

    describe('safeSetItem', () => {
        it('stores the value and returns true on success', () => {
            const mockStorage = {
                setItem: vi.fn()
            };
            global.localStorage = mockStorage;

            const result = safeSetItem('test-key', 'test-value');

            expect(mockStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
            expect(result).toBe(true);
        });

        it('returns false when localStorage throws (quota exceeded)', () => {
            const mockStorage = {
                setItem: vi.fn().mockImplementation(() => {
                    throw new Error('QuotaExceededError');
                })
            };
            global.localStorage = mockStorage;

            const result = safeSetItem('test-key', 'test-value');

            expect(result).toBe(false);
        });

        it('returns false when localStorage throws (private browsing)', () => {
            const mockStorage = {
                setItem: vi.fn().mockImplementation(() => {
                    throw new Error('Storage disabled in private browsing');
                })
            };
            global.localStorage = mockStorage;

            const result = safeSetItem('test-key', 'test-value');

            expect(result).toBe(false);
        });
    });
});
