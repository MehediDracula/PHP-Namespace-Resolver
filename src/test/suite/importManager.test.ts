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
            { text: 'use App\\Models\\User;', line: 4, fqcn: 'App\\Models\\User', alias: null, className: 'User', kind: 'class' as const },
        ];

        assert.strictEqual(importManager.hasConflict(useStatements, 'User'), true);
        assert.strictEqual(importManager.hasConflict(useStatements, 'Post'), false);
    });

    test('hasConflict should detect alias conflicts', () => {
        const useStatements = [
            { text: 'use App\\Models\\User as AppUser;', line: 4, fqcn: 'App\\Models\\User', alias: 'AppUser', className: 'AppUser', kind: 'class' as const },
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

    test('changeSelectedClass should not prepend backslash when prependBackslash is false', async () => {
        const { editor } = await openEditor('<?php\n\nclass Foo extends Controller {}');

        const pos = new vscode.Position(2, 22);
        editor.selection = new vscode.Selection(pos, pos);

        await importManager.changeSelectedClass(
            editor,
            editor.selection,
            'App\\Http\\Controllers\\Controller',
            false
        );
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('App\\Http\\Controllers\\Controller'));
        assert.ok(!text.includes('\\\\App'));
    });

    test('changeSelectedClass should return early when no word at cursor', async () => {
        const { editor } = await openEditor('<?php\n\n');

        // Position cursor on empty line
        const pos = new vscode.Position(2, 0);
        editor.selection = new vscode.Selection(pos, pos);

        // Should not throw
        await importManager.changeSelectedClass(
            editor,
            editor.selection,
            'SomeClass',
            true
        );
        await wait();

        const text = getText(editor);
        assert.ok(!text.includes('SomeClass'));
    });

    test('importClass should show status message when class is already imported', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {}'
        );

        // Should not throw, just set status bar message
        await importManager.importClass(editor, editor.selection, 'App\\Models\\User');
        await wait();

        // The class should still be there unchanged
        const text = getText(editor);
        const count = (text.match(/use App\\Models\\User;/g) || []).length;
        assert.strictEqual(count, 1);
    });

    test('importClass should return early when fqcn has no valid class name', async () => {
        const { editor } = await openEditor(
            '<?php\n\nclass Foo {}'
        );

        // Should not throw for empty/invalid fqcn
        await importManager.importClass(editor, editor.selection, '');
        await wait();

        const text = getText(editor);
        assert.ok(!text.includes('use ;'));
    });

    test('changeMultipleSelectedClasses should replace multiple cursors in a single edit', async () => {
        const { editor } = await openEditor(
            '<?php\n\nclass Foo extends Controller {\n    public function bar(Request $r) {}\n}'
        );

        // Position cursors on "Controller" (line 2, col 22) and "Request" (line 3, col 24)
        const sel1 = new vscode.Selection(new vscode.Position(2, 22), new vscode.Position(2, 22));
        const sel2 = new vscode.Selection(new vscode.Position(3, 24), new vscode.Position(3, 24));

        await importManager.changeMultipleSelectedClasses(
            editor,
            [
                { selection: sel1, fqcn: 'App\\Http\\Controllers\\Controller' },
                { selection: sel2, fqcn: 'Illuminate\\Http\\Request' },
            ],
            true
        );
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('\\App\\Http\\Controllers\\Controller'));
        assert.ok(text.includes('\\Illuminate\\Http\\Request'));
    });

    test('changeMultipleSelectedClasses should replace duplicate cursors on same class name', async () => {
        const { editor } = await openEditor(
            '<?php\n\nfunction a(Request $a) {}\nfunction b(Request $b) {}'
        );

        const sel1 = new vscode.Selection(new vscode.Position(2, 11), new vscode.Position(2, 11));
        const sel2 = new vscode.Selection(new vscode.Position(3, 11), new vscode.Position(3, 11));

        await importManager.changeMultipleSelectedClasses(
            editor,
            [
                { selection: sel1, fqcn: 'Illuminate\\Http\\Request' },
                { selection: sel2, fqcn: 'Illuminate\\Http\\Request' },
            ],
            true
        );
        await wait();

        const text = getText(editor);
        const matches = text.match(/\\Illuminate\\Http\\Request/g) || [];
        assert.strictEqual(matches.length, 2);
        assert.ok(!text.includes('Request $a') || text.includes('\\Illuminate\\Http\\Request $a'));
    });

    test('changeMultipleSelectedClasses should skip selections with no word at cursor', async () => {
        const { editor } = await openEditor(
            '<?php\n\nfunction a(Request $a) {}\n'
        );

        // sel1 on "Request", sel2 on empty line
        const sel1 = new vscode.Selection(new vscode.Position(2, 11), new vscode.Position(2, 11));
        const sel2 = new vscode.Selection(new vscode.Position(3, 0), new vscode.Position(3, 0));

        await importManager.changeMultipleSelectedClasses(
            editor,
            [
                { selection: sel1, fqcn: 'Illuminate\\Http\\Request' },
                { selection: sel2, fqcn: 'Illuminate\\Http\\Request' },
            ],
            true
        );
        await wait();

        const text = getText(editor);
        const matches = text.match(/\\Illuminate\\Http\\Request/g) || [];
        assert.strictEqual(matches.length, 1);
    });

    test('changeMultipleSelectedClasses should not prepend backslash when prependBackslash is false', async () => {
        const { editor } = await openEditor(
            '<?php\n\nfunction a(Request $a) {}\nfunction b(Controller $b) {}'
        );

        const sel1 = new vscode.Selection(new vscode.Position(2, 11), new vscode.Position(2, 11));
        const sel2 = new vscode.Selection(new vscode.Position(3, 11), new vscode.Position(3, 11));

        await importManager.changeMultipleSelectedClasses(
            editor,
            [
                { selection: sel1, fqcn: 'Illuminate\\Http\\Request' },
                { selection: sel2, fqcn: 'App\\Http\\Controllers\\Controller' },
            ],
            false
        );
        await wait();

        const text = getText(editor);
        assert.ok(text.includes('Illuminate\\Http\\Request'));
        assert.ok(text.includes('App\\Http\\Controllers\\Controller'));
        assert.ok(!text.includes('\\\\Illuminate'));
        assert.ok(!text.includes('\\\\App'));
    });

    test('changeMultipleSelectedClasses should return early for empty replacements array', async () => {
        const { editor } = await openEditor('<?php\n\nclass Foo {}');

        const textBefore = getText(editor);

        await importManager.changeMultipleSelectedClasses(editor, [], true);
        await wait();

        assert.strictEqual(getText(editor), textBefore);
    });
});
