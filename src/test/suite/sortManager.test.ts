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
        sortManager.sort(editor);
        await wait();

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

        sortManager.sort(editor);
        await wait();

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

        sortManager.sort(editor);
        await wait();

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

        sortManager.sort(editor);
        await wait(500);

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

        sortManager.sort(editor);
        await wait(500);

        const text = getText(editor);
        assert.ok(text.indexOf('Handler1;') < text.indexOf('Handler2'),
            `Expected Handler1 before Handler2. Text:\n${text}`);
        assert.ok(text.indexOf('Handler2') < text.indexOf('Handler10'),
            `Expected Handler2 before Handler10. Text:\n${text}`);

        await config.update('sortMode', undefined, vscode.ConfigurationTarget.Global);
        await wait(500);
    });
});
