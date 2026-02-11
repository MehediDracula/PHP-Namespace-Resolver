import * as assert from 'assert';
import * as vscode from 'vscode';
import { PhpClassDetector } from '../../core/PhpClassDetector';
import { DeclarationParser } from '../../core/DeclarationParser';
import { DiagnosticManager } from '../../features/DiagnosticManager';
import { DiagnosticCode } from '../../types';
import { createDocument, wait } from './helper';

suite('DiagnosticManager (VS Code Integration)', () => {
    const detector = new PhpClassDetector();
    const parser = new DeclarationParser();
    let manager: DiagnosticManager;

    setup(() => {
        manager = new DiagnosticManager(detector, parser);
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
            assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Hint);
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

    test('should only report first occurrence per unimported class', async () => {
        const doc = await createDocument(
            '<?php\n\nclass Foo {\n    public function bar(Request $r): Request {}\n    public function baz(Request $r2) {}\n}'
        );

        manager.update(doc);
        await wait();

        const diagnostics = manager.getDiagnostics(doc.uri);
        const requestDiags = diagnostics.filter(
            d => d.code === DiagnosticCode.ClassNotImported && d.message.includes('Request')
        );
        assert.strictEqual(requestDiags.length, 1);
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
});
