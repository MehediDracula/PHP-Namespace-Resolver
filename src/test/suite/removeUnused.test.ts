import * as assert from 'assert';
import { PhpClassDetector } from '../../core/PhpClassDetector';
import { DeclarationParser } from '../../core/DeclarationParser';
import { RemoveUnusedCommand } from '../../features/RemoveUnusedCommand';
import { openEditor, getText, wait } from './helper';

suite('RemoveUnusedCommand (VS Code Integration)', () => {
    const detector = new PhpClassDetector();
    const parser = new DeclarationParser();
    const command = new RemoveUnusedCommand(detector, parser);

    test('should remove unused import', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse App\\Models\\User;\nuse App\\Models\\Post;\n\nclass Foo {\n    public function bar(): User {}\n}'
        );

        const removed = await command.removeUnused(editor);
        await wait();

        assert.strictEqual(removed, 1);
        const text = getText(editor);
        assert.ok(!text.includes('App\\Models\\Post'));
        assert.ok(text.includes('App\\Models\\User'));
    });

    test('should remove all unused imports', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse App\\Models\\User;\nuse App\\Models\\Post;\nuse App\\Models\\Comment;\n\nclass Foo {}'
        );

        const removed = await command.removeUnused(editor);
        await wait();

        assert.strictEqual(removed, 3);
        const text = getText(editor);
        assert.ok(!text.includes('use App'));
    });

    test('should return 0 when all imports are used', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {\n    public function bar(): User {}\n}'
        );

        const removed = await command.removeUnused(editor);
        assert.strictEqual(removed, 0);
    });

    test('should handle file with no imports', async () => {
        const { editor } = await openEditor(
            '<?php\n\nclass Foo {}'
        );

        const removed = await command.removeUnused(editor);
        assert.strictEqual(removed, 0);
    });

    test('should keep aliased imports that are used by alias', async () => {
        const { editor } = await openEditor(
            '<?php\n\nuse App\\Models\\User as AppUser;\n\nclass Foo {\n    public function bar(): AppUser {}\n}'
        );

        const removed = await command.removeUnused(editor);
        assert.strictEqual(removed, 0);
        const text = getText(editor);
        assert.ok(text.includes('use App\\Models\\User as AppUser;'));
    });

    test('should remove multiple unused while keeping used ones', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse Illuminate\\Http\\Request;\nuse App\\Models\\User;\nuse App\\Models\\Post;\nuse Illuminate\\Support\\Collection;\n\nclass Foo {\n    public function index(Request $request): Collection {}\n}'
        );

        const removed = await command.removeUnused(editor);
        await wait();

        assert.strictEqual(removed, 2);
        const text = getText(editor);
        assert.ok(text.includes('Illuminate\\Http\\Request'));
        assert.ok(text.includes('Illuminate\\Support\\Collection'));
        assert.ok(!text.includes('App\\Models\\User'));
        assert.ok(!text.includes('App\\Models\\Post'));
    });

    test('should clean up consecutive blank lines after removal', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse App\\Models\\User;\n\nuse App\\Models\\Post;\n\nclass Foo {\n    public function bar(): Post {}\n}'
        );

        const removed = await command.removeUnused(editor);
        await wait(200);

        assert.strictEqual(removed, 1);
        const text = getText(editor);
        assert.ok(!text.includes('App\\Models\\User'));
        assert.ok(text.includes('App\\Models\\Post'));
        // Should not have more than 2 consecutive newlines in the use area
        assert.ok(!text.match(/use App\\Models\\Post;\n\n\n/), 'Should not have triple newlines after cleanup');
    });

    test('should correctly remove imports in reverse order to avoid line shifting', async () => {
        const { editor } = await openEditor(
            '<?php\n\nnamespace App;\n\nuse App\\A;\nuse App\\B;\nuse App\\C;\nuse App\\D;\n\nclass Foo {\n    public function bar(): B {}\n}'
        );

        const removed = await command.removeUnused(editor);
        await wait();

        assert.strictEqual(removed, 3);
        const text = getText(editor);
        assert.ok(text.includes('use App\\B;'));
        assert.ok(!text.includes('use App\\A;'));
        assert.ok(!text.includes('use App\\C;'));
        assert.ok(!text.includes('use App\\D;'));
    });
});
