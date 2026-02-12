import * as assert from 'assert';
import * as vscode from 'vscode';
import { PhpClassDetector } from '../../core/PhpClassDetector';
import { DeclarationParser } from '../../core/DeclarationParser';
import { NamespaceCache } from '../../core/NamespaceCache';
import { DiagnosticManager } from '../../features/DiagnosticManager';
import { DiagnosticCode, CacheEntry } from '../../types';
import { createDocument, wait } from './helper';

class FakeNamespaceCache extends NamespaceCache {
    private entries = new Map<string, CacheEntry[]>();

    addEntry(className: string, fqcn: string): void {
        if (!this.entries.has(className)) {
            this.entries.set(className, []);
        }
        this.entries.get(className)!.push({
            fqcn,
            uri: vscode.Uri.file(`/fake/${className}.php`),
            className,
        });
    }

    override lookup(className: string): CacheEntry[] {
        return this.entries.get(className) ?? [];
    }
}

suite('DiagnosticManager (VS Code Integration)', () => {
    const detector = new PhpClassDetector();
    const parser = new DeclarationParser();
    let cache: FakeNamespaceCache;
    let manager: DiagnosticManager;

    setup(() => {
        cache = new FakeNamespaceCache();
        manager = new DiagnosticManager(detector, parser, cache);
    });

    teardown(() => {
        manager.dispose();
    });

    test('should report unimported class as warning', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo extends Controller {\n    public function bar(Request $request) {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported
        );

        assert.ok(notImported.length >= 2, `Expected at least 2 unimported warnings, got ${notImported.length}`);

        const classNames = notImported.map(d => d.message);
        assert.ok(classNames.some(m => m.includes('Controller')));
        assert.ok(classNames.some(m => m.includes('Request')));

        for (const d of notImported) {
            assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Warning);
            assert.strictEqual(d.source, 'PHP Namespace Resolver');
        }
    });

    test('should report unused imports as hints', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User;\nuse App\\Models\\Post;\n\nclass Foo {}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notUsed = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotUsed
        );

        assert.strictEqual(notUsed.length, 2);

        const classNames = notUsed.map(d => d.message);
        assert.ok(classNames.some(m => m.includes('User')));
        assert.ok(classNames.some(m => m.includes('Post')));

        for (const d of notUsed) {
            assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Warning);
            assert.ok(d.tags?.includes(vscode.DiagnosticTag.Unnecessary));
        }
    });

    test('should not report imported and used classes', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {\n    public function bar(): User {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const userDiags = diagnostics.filter(d => d.message.includes('User'));
        assert.strictEqual(userDiags.length, 0);
    });

    test('should report both unimported and unused in same file', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\Post;\n\nclass Foo extends Controller {\n    public function bar(): User {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);

        const notImported = diagnostics.filter(d => d.code === DiagnosticCode.ClassNotImported);
        const notUsed = diagnostics.filter(d => d.code === DiagnosticCode.ClassNotUsed);

        assert.ok(notImported.length >= 2, 'Should have unimported classes');
        assert.ok(notUsed.length >= 1, 'Should have unused imports');
    });

    test('should clear diagnostics for a document', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {}'
        );

        manager.update(doc);
        await wait();

        let diagnostics = manager.getDiagnostics(doc.uri);
        assert.ok(diagnostics.length > 0);

        manager.clear(doc.uri);
        await wait();

        diagnostics = manager.getDiagnostics(doc.uri);
        assert.strictEqual(diagnostics.length, 0);
    });

    test('should not report diagnostics for non-PHP files', async () => {
        // Create a non-PHP document
        const doc = await vscode.workspace.openTextDocument({
            language: 'plaintext',
            content: 'use App\\Models\\User;\nclass Foo extends Controller {}',
        });

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        assert.strictEqual(diagnostics.length, 0);
    });

    test('should handle empty PHP file', async () => {
        const doc = await createDocument('<?php\n');

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        assert.strictEqual(diagnostics.length, 0);
    });

    test('should not report class name that is part of a longer word', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    // TestController is not the same as Controller\n    public function getController(): Controller {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const controllerDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Controller')
        );
        // Should only report Controller, not from TestController
        assert.strictEqual(controllerDiags.length, 1);
    });

    test('should report all occurrences of unimported class', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    public function bar(Request $r): Request {}\n    public function baz(Request $r2) {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const requestDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Request')
        );
        assert.strictEqual(requestDiags.length, 3);
    });

    test('should not report class imported via grouped use statement', async () => {
        const doc = await createDocument(
            '<?php\n\nuse Example1\\Example2\\Models\\{SomeClass};\n\nclass Foo {\n    public function example(): SomeClass {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('SomeClass')
        );
        assert.strictEqual(notImported.length, 0, 'SomeClass should be recognized as imported via grouped use');
    });

    test('should not report classes imported via multi-class grouped use statement', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{User, Post};\n\nclass Foo {\n    public function bar(): User {}\n    public function baz(): Post {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported
        );
        assert.strictEqual(notImported.length, 0, 'Both User and Post should be recognized as imported');
    });

    test('clearAll should remove all diagnostics', async () => {
        const doc1 = await createDocument(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {}'
        );
        const doc2 = await createDocument(
            '<?php\n\nuse App\\Models\\Post;\n\nclass Bar {}'
        );

        manager.update(doc1);
        manager.update(doc2);
        await wait();

        assert.ok(manager.getDiagnostics(doc1.uri).length > 0);
        assert.ok(manager.getDiagnostics(doc2.uri).length > 0);

        manager.clearAll();
        await wait();

        assert.strictEqual(manager.getDiagnostics(doc1.uri).length, 0);
        assert.strictEqual(manager.getDiagnostics(doc2.uri).length, 0);
    });

    test('should not report class names inside single-line comments', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    // Hidden is used here\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const hiddenDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Hidden')
        );
        assert.strictEqual(hiddenDiags.length, 0, 'Should not report class names in // comments');
    });

    test('should not report class names inside block comments', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    /* Hidden block comment */\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const hiddenDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Hidden')
        );
        assert.strictEqual(hiddenDiags.length, 0, 'Should not report class names in block comments');
    });

    test('should not report class names inside comments (combined)', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App\\Services;\n\nclass Foo {\n    // Hidden is used here\n    /* Hidden block comment */\n    /** @var Hidden $h */\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Hidden')
        );

        assert.strictEqual(
            notImported.length, 0,
            `Expected no diagnostics for class names in comments, got: ${notImported.map(d => d.message).join(', ')}`
        );
    });

    test('should not report class names after inline // comment', async () => {
        const doc = await createDocument(
            '<?php\n\nuse Illuminate\\Http\\Request;\n\nclass Foo {\n    public function bar(Request $r) {} // Controller handles this\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const controllerDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Controller')
        );
        assert.strictEqual(controllerDiags.length, 0, 'Should not report class names in inline comments');
    });

    test('should not report class names inside # comments', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    # Hidden in hash comment\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const hiddenDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Hidden')
        );
        assert.strictEqual(hiddenDiags.length, 0, 'Should not report class names in # comments');
    });

    test('should still report class names in attributes (not confused with # comments)', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    #[Route("/api")]\n    public function index() {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const routeDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Route')
        );
        assert.strictEqual(routeDiags.length, 1, 'Should still report class names in #[] attributes');
    });

    test('should not report import as unused when used as namespace prefix', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App\\Services;\n\nuse App\\Models;\n\nclass Foo {\n    public function bar() {\n        return Models\\User::query();\n    }\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notUsed = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotUsed && d.message.includes('Models')
        );
        assert.strictEqual(notUsed.length, 0, 'Should not report import as unused when used as namespace prefix');
    });

    test('should not report import as unused when used as namespace prefix with new', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App\\Services;\n\nuse App\\Models;\n\nclass Foo {\n    public function bar() {\n        return new Models\\User();\n    }\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notUsed = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotUsed && d.message.includes('Models')
        );
        assert.strictEqual(notUsed.length, 0, 'Should not report import as unused when used as namespace prefix with new');
    });

    test('should not report imported trait as unused', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App\\Services;\n\nuse App\\Traits\\HasLogger;\n\nclass UserService {\n    use HasLogger;\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notUsed = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotUsed && d.message.includes('HasLogger')
        );
        assert.strictEqual(notUsed.length, 0, 'Should not report imported trait that is used in a class body');
    });

    test('should not report imported traits used with multiple traits on one line', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App\\Models;\n\nuse App\\Traits\\HasLogger;\nuse App\\Traits\\SoftDeletes;\n\nclass User {\n    use HasLogger, SoftDeletes;\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notUsed = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotUsed
        );
        assert.strictEqual(notUsed.length, 0, 'Should not report unused warnings for used traits');
    });

    test('should not report class that exists in the same namespace', async () => {
        cache.addEntry('UserRepository', 'App\\Services\\UserRepository');

        const doc = await createDocument(
            '<?php\n\nnamespace App\\Services;\n\nclass UserService {\n    public function find(): UserRepository {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported
        );
        assert.strictEqual(notImported.length, 0, 'Should not report same-namespace class as unimported');
    });

    test('should still report class from a different namespace as not imported', async () => {
        cache.addEntry('User', 'App\\Models\\User');

        const doc = await createDocument(
            '<?php\n\nnamespace App\\Services;\n\nclass UserService {\n    public function find(): User {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('User')
        );
        assert.strictEqual(notImported.length, 1, 'Should report class from different namespace');
    });

    test('should not report same-namespace class when cache has multiple entries', async () => {
        cache.addEntry('Event', 'App\\Events\\Event');
        cache.addEntry('Event', 'Illuminate\\Support\\Facades\\Event');

        const doc = await createDocument(
            '<?php\n\nnamespace App\\Events;\n\nclass OrderCreated {\n    public function dispatch(): Event {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const notImported = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Event')
        );
        assert.strictEqual(notImported.length, 0, 'Should not report class that has a matching entry in the same namespace');
    });
});
