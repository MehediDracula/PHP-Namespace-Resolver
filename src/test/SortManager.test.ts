/**
 * Unit tests for natural sort comparison logic.
 * SortManager itself requires VS Code APIs, so we test the underlying sort logic.
 */
import * as assert from 'assert';

// Re-implement the natural compare function for testing
function naturalCompare(a: string, b: string): number {
    const aParts = a.split(/(\d+)/);
    const bParts = b.split(/(\d+)/);

    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        const aPart = aParts[i];
        const bPart = bParts[i];

        if (aPart === bPart) { continue; }

        const aNum = parseInt(aPart, 10);
        const bNum = parseInt(bPart, 10);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }

        return aPart.localeCompare(bPart);
    }

    return aParts.length - bParts.length;
}

describe('Natural Sort', () => {
    it('should sort strings with numbers naturally', () => {
        const items = ['item10', 'item2', 'item1', 'item20'];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, ['item1', 'item2', 'item10', 'item20']);
    });

    it('should sort alphabetically when no numbers', () => {
        const items = ['banana', 'apple', 'cherry'];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, ['apple', 'banana', 'cherry']);
    });

    it('should handle use statements', () => {
        const items = [
            'use App\\Models\\User;',
            'use App\\Http\\Request;',
            'use App\\Http\\Controller;',
        ];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, [
            'use App\\Http\\Controller;',
            'use App\\Http\\Request;',
            'use App\\Models\\User;',
        ]);
    });
});

describe('Length Sort', () => {
    it('should sort by length with alphabetical tiebreaker', () => {
        const items = [
            'use App\\Models\\User;',
            'use App\\Http\\Request;',
            'use App\\Http\\Controller;',
        ];

        items.sort((a, b) => {
            if (a.length === b.length) {
                return a.toLowerCase().localeCompare(b.toLowerCase());
            }
            return a.length - b.length;
        });

        // Shortest first
        assert.ok(items[0].length <= items[1].length);
        assert.ok(items[1].length <= items[2].length);
    });
});

describe('Alphabetical Sort', () => {
    it('should sort case-insensitively', () => {
        const items = [
            'use Zebra\\Class;',
            'use apple\\Class;',
            'use Banana\\Class;',
        ];

        items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        assert.deepStrictEqual(items, [
            'use apple\\Class;',
            'use Banana\\Class;',
            'use Zebra\\Class;',
        ]);
    });
});

describe('Natural Sort - edge cases', () => {
    it('should sort purely numeric strings numerically', () => {
        const items = ['100', '20', '3', '1'];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, ['1', '3', '20', '100']);
    });

    it('should handle empty strings', () => {
        const items = ['b', '', 'a'];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, ['', 'a', 'b']);
    });

    it('should handle strings where one is prefix of another', () => {
        const items = ['item10', 'item1', 'item'];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, ['item', 'item1', 'item10']);
    });

    it('should handle strings with consecutive numbers', () => {
        const items = ['file100part2', 'file100part1', 'file2part10'];
        items.sort(naturalCompare);
        assert.deepStrictEqual(items, ['file2part10', 'file100part1', 'file100part2']);
    });
});
