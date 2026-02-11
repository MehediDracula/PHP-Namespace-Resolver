import { getInsertPosition } from '../core/insertPosition';
import { DeclarationLines } from '../types';
import * as assert from 'assert';

describe('getInsertPosition', () => {
    it('should insert after php tag when no other declarations exist', () => {
        const decl: DeclarationLines = {
            phpTag: 1,
            namespace: null,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: null,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.line, 1);
        assert.strictEqual(pos.prepend, '\n');
        assert.strictEqual(pos.append, '\n');
    });

    it('should insert after namespace when no use statements exist', () => {
        const decl: DeclarationLines = {
            phpTag: 1,
            namespace: 3,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: null,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.line, 3);
        assert.strictEqual(pos.prepend, '\n');
    });

    it('should insert after last use statement', () => {
        const decl: DeclarationLines = {
            phpTag: 1,
            namespace: 3,
            firstUseStatement: 5,
            lastUseStatement: 7,
            classDeclaration: null,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.line, 7);
        assert.strictEqual(pos.prepend, '');
    });

    it('should add extra newline when class is directly after insert point', () => {
        const decl: DeclarationLines = {
            phpTag: 1,
            namespace: 3,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: 4,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.append, '\n\n');
    });

    it('should not add extra newline when class has spacing', () => {
        const decl: DeclarationLines = {
            phpTag: 1,
            namespace: 3,
            firstUseStatement: 5,
            lastUseStatement: 7,
            classDeclaration: 10,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.append, '\n');
    });

    it('should handle file without php tag (phpTag = 0)', () => {
        const decl: DeclarationLines = {
            phpTag: 0,
            namespace: null,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: null,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.line, 0);
        assert.strictEqual(pos.prepend, '');
    });

    it('should add newline prepend when no php tag but namespace exists', () => {
        const decl: DeclarationLines = {
            phpTag: 0,
            namespace: 2,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: null,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.prepend, '\n');
        assert.strictEqual(pos.line, 2);
    });

    it('should handle class immediately after use statements', () => {
        const decl: DeclarationLines = {
            phpTag: 1,
            namespace: 3,
            firstUseStatement: 5,
            lastUseStatement: 6,
            classDeclaration: 7,
        };
        const pos = getInsertPosition(decl);
        assert.strictEqual(pos.line, 6);
        assert.strictEqual(pos.append, '\n\n');
    });
});
