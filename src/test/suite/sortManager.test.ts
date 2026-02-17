import * as assert from 'assert';
import * as vscode from 'vscode';
import { DeclarationParser } from '../../core/DeclarationParser';
import { SortManager } from '../../core/SortManager';
import { openEditor, getText, wait } from './helper';

suite('SortManager (VS Code Integration)', () => {
    const parser = new DeclarationParser();
    const sortManager = new SortManager(parser);

    test('should sort use statements by length (default)', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse Illuminate\\Http\\Request;\nuse App\\Models\\User;\nuse Illuminate\\Support\\Collection;\n\nclass Foo {}'
        );

        // Default config is sort by length
        await sortManager.sort(editor);

        const text = getText(editor);
        const lines = text.split('\n');
        // Shortest first
        assert.ok(lines[2].includes('App\\Models\\User'));
        assert.ok(lines[3].includes('Illuminate\\Http\\Request'));
        assert.ok(lines[4].includes('Illuminate\\Support\\Collection'));
    });

    test('should throw when nothing to sort (single import)', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {}'
        );

        assert.throws(
            () => sortManager.sort(editor),
            /Nothing to sort/
        );
    });

    test('should throw when nothing to sort (no imports)', async () => {
        const { editor } = await openEditor(
            '<?php\n\nclass Foo {}'
        );

        assert.throws(
            () => sortManager.sort(editor),
            /Nothing to sort/
        );
    });

    test('should preserve non-use lines around sorted imports', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse Zzz\\Long\\ClassName;\nuse Aaa\\Short;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        assert.ok(text.includes('namespace App;'));
        assert.ok(text.includes('class Foo {}'));
        // Short one should come first (by length)
        assert.ok(text.indexOf('Aaa\\Short') < text.indexOf('Zzz\\Long\\ClassName'));
    });

    test('should sort two use statements', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse Illuminate\\Support\\Collection;\nuse App\\User;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        assert.ok(text.indexOf('App\\User') < text.indexOf('Illuminate\\Support\\Collection'));
    });

    test('should sort alphabetically when configured', async () => {
        const config = vscode.workspace.getConfiguration('phpNamespaceResolver');
        await config.update('sortMode', 'alphabetical', vscode.ConfigurationTarget.Global);
        await wait(500);

        const { editor } = await openEditor(
            '<?php\n\nuse Zzz\\Short;\nuse Aaa\\VeryLongClassName;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        // Alphabetical: Aaa before Zzz, regardless of length
        assert.ok(text.indexOf('Aaa\\VeryLongClassName') < text.indexOf('Zzz\\Short'),
            `Expected Aaa before Zzz. Text:\n${text}`);

        await config.update('sortMode', undefined, vscode.ConfigurationTarget.Global);
        await wait(500);
    });

    test('should sort naturally when configured', async () => {
        const config = vscode.workspace.getConfiguration('phpNamespaceResolver');
        await config.update('sortMode', 'natural', vscode.ConfigurationTarget.Global);
        await wait(500);

        const { editor } = await openEditor(
            '<?php\n\nuse App\\Handler10;\nuse App\\Handler2;\nuse App\\Handler1;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        assert.ok(text.indexOf('Handler1;') < text.indexOf('Handler2'),
            `Expected Handler1 before Handler2. Text:\n${text}`);
        assert.ok(text.indexOf('Handler2') < text.indexOf('Handler10'),
            `Expected Handler2 before Handler10. Text:\n${text}`);

        await config.update('sortMode', undefined, vscode.ConfigurationTarget.Global);
        await wait(500);
    });

    test('should group use function after class imports', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse function Laravel\\Prompts\\info;\nuse Illuminate\\Http\\Request;\nuse App\\Models\\User;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        // Class imports should come first, then function imports
        assert.ok(text.indexOf('App\\Models\\User') < text.indexOf('function Laravel\\Prompts\\info'),
            `Expected class imports before function imports. Text:\n${text}`);
        assert.ok(text.indexOf('Illuminate\\Http\\Request') < text.indexOf('function Laravel\\Prompts\\info'),
            `Expected class imports before function imports. Text:\n${text}`);
    });

    test('should group use const after function imports', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse const App\\Config\\VERSION;\nuse function App\\Helpers\\helper;\nuse App\\Models\\User;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        // Order: class, function, const
        assert.ok(text.indexOf('App\\Models\\User') < text.indexOf('function App\\Helpers\\helper'),
            `Expected class before function. Text:\n${text}`);
        assert.ok(text.indexOf('function App\\Helpers\\helper') < text.indexOf('const App\\Config\\VERSION'),
            `Expected function before const. Text:\n${text}`);
    });

    test('should eliminate blank line gaps between class imports', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse Illuminate\\Http\\Request;\n\nuse App\\Models\\User;\nuse Illuminate\\Support\\Collection;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        const lines = text.split('\n');
        // Find the use block — should have no blank lines within class group
        const useLines = lines.filter(l => l.startsWith('use '));
        assert.strictEqual(useLines.length, 3);

        // Check there's no blank line between consecutive use statements
        const firstUseIdx = lines.findIndex(l => l.startsWith('use '));
        const lastUseIdx = lines.length - 1 - [...lines].reverse().findIndex(l => l.startsWith('use '));
        for (let i = firstUseIdx; i <= lastUseIdx; i++) {
            if (lines[i].trim() === '') {
                assert.fail(`Unexpected blank line at index ${i} within use block. Text:\n${text}`);
            }
        }
    });

    test('should add blank line separator between kind groups', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse App\\Models\\User;\nuse function App\\Helpers\\helper;\n\nclass Foo {}'
        );

        await sortManager.sort(editor);

        const text = getText(editor);
        // Should have a blank line between class and function groups
        assert.ok(text.includes('use App\\Models\\User;\n\nuse function App\\Helpers\\helper;'),
            `Expected blank line between groups. Text:\n${text}`);
    });
});
