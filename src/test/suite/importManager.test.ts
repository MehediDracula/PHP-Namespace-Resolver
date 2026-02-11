import * as assert from 'assert';
import * as vscode from 'vscode';
import { DeclarationParser } from '../../core/DeclarationParser';
import { ImportManager } from '../../core/ImportManager';
import { openEditor, getText, wait } from './helper';

suite('ImportManager (VS Code Integration)', () => {
    const parser = new DeclarationParser();
    // No-op sort callback for tests
    const importManager = new ImportManager(parser, () => {});

    test('should insert use statement after namespace', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nclass Foo {}'
        );

        const { declarationLines } = parser.parse(editor.document);
        await importManager.insert(editor, 'App\\Models\\User', declarationLines);
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('use App\\Models\\User;'));
    });

    test('should insert use statement after existing use statements', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse App\\Models\\Post;\n\nclass Foo {}'
        );

        const { declarationLines } = parser.parse(editor.document);
        await importManager.insert(editor, 'App\\Models\\User', declarationLines);
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('use App\\Models\\User;'));
        assert.ok(text.includes('use App\\Models\\Post;'));
    });

    test('should insert use statement with alias', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nclass Foo {}'
        );

        const { declarationLines } = parser.parse(editor.document);
        await importManager.insert(editor, 'App\\Models\\User', declarationLines, 'AppUser');
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('use App\\Models\\User as AppUser;'));
    });

    test('hasConflict should detect conflicting class names', () => {
        const useStatements = [
            { text: 'use App\\Models\\User;', line: 4, fqcn: 'App\\Models\\User', alias: null, className: 'User' },
        ];

        assert.strictEqual(importManager.hasConflict(useStatements, 'User'), true);
        assert.strictEqual(importManager.hasConflict(useStatements, 'Post'), false);
    });

    test('hasConflict should detect alias conflicts', () => {
        const useStatements = [
            { text: 'use App\\Models\\User as AppUser;', line: 4, fqcn: 'App\\Models\\User', alias: 'AppUser', className: 'AppUser' },
        ];

        assert.strictEqual(importManager.hasConflict(useStatements, 'AppUser'), true);
        assert.strictEqual(importManager.hasConflict(useStatements, 'User'), false);
    });

    test('should insert at correct position in file with just <?php', async () => {
        const { editor } = await openEditor('<?php\n\nclass Foo {}');

        const { declarationLines } = parser.parse(editor.document);
        await importManager.insert(editor, 'App\\Models\\User', declarationLines);
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('use App\\Models\\User;'));
        // Use statement should come before class
        assert.ok(text.indexOf('use App\\Models\\User;') < text.indexOf('class Foo'));
    });

    test('changeSelectedClass should replace word at cursor', async () => {
        const { editor } = await openEditor('<?php\n\nclass Foo extends Controller {}');

        // Position cursor on "Controller"
        const pos = new vscode.Position(2, 22);
        editor.selection = new vscode.Selection(pos, pos);

        await importManager.changeSelectedClass(
            editor,
            editor.selection,
            'App\\Http\\Controllers\\Controller',
            true
        );
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('\\App\\Http\\Controllers\\Controller'));
    });
});
