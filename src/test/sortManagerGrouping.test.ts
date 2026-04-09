import * as assert from 'assert';
import { joinUseLinesWithOptionalNamespaceGaps } from '../core/joinUseLines';
import { UseStatement } from '../types';

function stmt(text: string, fqcn: string, line = 1, kind: UseStatement['kind'] = 'class'): UseStatement {
    return { text, line, fqcn, alias: null, className: fqcn.split('\\').pop()!, kind };
}

describe('joinUseLinesWithOptionalNamespaceGaps', () => {
    it('returns empty string for empty input', () => {
        assert.strictEqual(joinUseLinesWithOptionalNamespaceGaps([], false), '');
        assert.strictEqual(joinUseLinesWithOptionalNamespaceGaps([], true), '');
    });

    it('when separate is false, joins with single newlines regardless of root', () => {
        const stmts = [
            stmt('use App\\Models\\User;', 'App\\Models\\User', 1),
            stmt('use Illuminate\\Http\\Request;', 'Illuminate\\Http\\Request', 2),
        ];
        const out = joinUseLinesWithOptionalNamespaceGaps(stmts, false);
        assert.strictEqual(out, 'use App\\Models\\User;\nuse Illuminate\\Http\\Request;');
    });

    it('when separate is true, inserts blank line between different roots', () => {
        const stmts = [
            stmt('use App\\Models\\User;', 'App\\Models\\User', 1),
            stmt('use Illuminate\\Http\\Request;', 'Illuminate\\Http\\Request', 2),
        ];
        const out = joinUseLinesWithOptionalNamespaceGaps(stmts, true);
        assert.strictEqual(out, 'use App\\Models\\User;\n\nuse Illuminate\\Http\\Request;');
    });

    it('when separate is true, single newline between same root', () => {
        const stmts = [
            stmt('use App\\Http\\Request;', 'App\\Http\\Request', 1),
            stmt('use App\\Models\\User;', 'App\\Models\\User', 2),
        ];
        const out = joinUseLinesWithOptionalNamespaceGaps(stmts, true);
        assert.strictEqual(out, 'use App\\Http\\Request;\nuse App\\Models\\User;');
    });

    it('treats case variants of root as same group', () => {
        const stmts = [
            stmt('use App\\Foo;', 'App\\Foo', 1),
            stmt('use app\\Bar;', 'app\\Bar', 2),
        ];
        const out = joinUseLinesWithOptionalNamespaceGaps(stmts, true);
        assert.strictEqual(out, 'use App\\Foo;\nuse app\\Bar;');
    });

    it('single-segment FQCN uses whole name as root', () => {
        const stmts = [
            stmt('use SomeGlobal;', 'SomeGlobal', 1),
            stmt('use Other;', 'Other', 2),
        ];
        const out = joinUseLinesWithOptionalNamespaceGaps(stmts, true);
        assert.strictEqual(out, 'use SomeGlobal;\n\nuse Other;');
    });

    it('applies to function imports the same way', () => {
        const stmts = [
            stmt('use function App\\Helpers\\a;', 'App\\Helpers\\a', 1, 'function'),
            stmt('use function Illuminate\\Support\\b;', 'Illuminate\\Support\\b', 2, 'function'),
        ];
        const out = joinUseLinesWithOptionalNamespaceGaps(stmts, true);
        assert.strictEqual(
            out,
            'use function App\\Helpers\\a;\n\nuse function Illuminate\\Support\\b;'
        );
    });
});
