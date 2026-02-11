import * as assert from 'assert';
import * as vscode from 'vscode';
import { PhpCodeActionProvider } from '../../features/CodeActionProvider';
import { DiagnosticCode } from '../../types';
import { wait } from './helper';

suite('PhpCodeActionProvider (VS Code Integration)', () => {
    const provider = new PhpCodeActionProvider();

    function makeDiagnostic(
        code: DiagnosticCode,
        message: string,
        line: number = 0
    ): vscode.Diagnostic {
        const range = new vscode.Range(line, 0, line, 10);
        const diag = new vscode.Diagnostic(
            range,
            message,
            code === DiagnosticCode.ClassNotImported
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Hint
        );
        diag.code = code;
        diag.source = 'PHP Namespace Resolver';
        return diag;
    }

    test('should provide import and expand actions for unimported class', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: '<?php\n\nclass Foo extends Controller {}',
        });

        const diagnostic = makeDiagnostic(
            DiagnosticCode.ClassNotImported,
            "Class 'Controller' is not imported.",
            2
        );

        const context: vscode.CodeActionContext = {
            diagnostics: [diagnostic],
            triggerKind: vscode.CodeActionTriggerKind.Automatic,
            only: undefined,
        };

        const range = new vscode.Range(2, 20, 2, 30);
        const actions = provider.provideCodeActions(doc, range, context, new vscode.CancellationTokenSource().token);

        assert.strictEqual(actions.length, 2);

        const importAction = actions.find(a => a.title === 'Import class');
        assert.ok(importAction, 'Should have Import class action');
        assert.strictEqual(importAction!.command?.command, 'phpNamespaceResolver.import');
        assert.strictEqual(importAction!.isPreferred, true);

        const expandAction = actions.find(a => a.title === 'Expand to fully qualified name');
        assert.ok(expandAction, 'Should have Expand action');
        assert.strictEqual(expandAction!.command?.command, 'phpNamespaceResolver.expand');
    });

    test('should provide remove action for unused import', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: '<?php\n\nuse App\\Models\\User;\n\nclass Foo {}',
        });

        const diagnostic = makeDiagnostic(
            DiagnosticCode.ClassNotUsed,
            "Imported class 'User' is not used.",
            2
        );

        const context: vscode.CodeActionContext = {
            diagnostics: [diagnostic],
            triggerKind: vscode.CodeActionTriggerKind.Automatic,
            only: undefined,
        };

        const range = new vscode.Range(2, 0, 2, 20);
        const actions = provider.provideCodeActions(doc, range, context, new vscode.CancellationTokenSource().token);

        assert.strictEqual(actions.length, 1);

        const removeAction = actions[0];
        assert.strictEqual(removeAction.title, 'Remove unused import');
        assert.strictEqual(removeAction.command?.command, 'phpNamespaceResolver.removeUnused');
        assert.strictEqual(removeAction.isPreferred, true);
    });

    test('should return empty actions for non-matching diagnostics', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: '<?php\n',
        });

        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 5),
            'Some other diagnostic',
            vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'some-other-source';

        const context: vscode.CodeActionContext = {
            diagnostics: [diagnostic],
            triggerKind: vscode.CodeActionTriggerKind.Automatic,
            only: undefined,
        };

        const range = new vscode.Range(0, 0, 0, 5);
        const actions = provider.provideCodeActions(doc, range, context, new vscode.CancellationTokenSource().token);

        assert.strictEqual(actions.length, 0);
    });

    test('should handle mixed diagnostics (import + unused)', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: '<?php\n\nuse App\\Post;\n\nclass Foo extends Controller {}',
        });

        const importDiag = makeDiagnostic(
            DiagnosticCode.ClassNotImported,
            "Class 'Controller' is not imported.",
            4
        );

        const unusedDiag = makeDiagnostic(
            DiagnosticCode.ClassNotUsed,
            "Imported class 'Post' is not used.",
            2
        );

        const context: vscode.CodeActionContext = {
            diagnostics: [importDiag, unusedDiag],
            triggerKind: vscode.CodeActionTriggerKind.Automatic,
            only: undefined,
        };

        const range = new vscode.Range(2, 0, 4, 30);
        const actions = provider.provideCodeActions(doc, range, context, new vscode.CancellationTokenSource().token);

        // 2 for import (Import + Expand) + 1 for unused (Remove)
        assert.strictEqual(actions.length, 3);
    });

    test('should set correct CodeActionKind', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'php',
            content: '<?php\n',
        });

        const diagnostic = makeDiagnostic(
            DiagnosticCode.ClassNotImported,
            "Class 'Foo' is not imported."
        );

        const context: vscode.CodeActionContext = {
            diagnostics: [diagnostic],
            triggerKind: vscode.CodeActionTriggerKind.Automatic,
            only: undefined,
        };

        const range = new vscode.Range(0, 0, 0, 5);
        const actions = provider.provideCodeActions(doc, range, context, new vscode.CancellationTokenSource().token);

        for (const action of actions) {
            assert.strictEqual(action.kind?.value, vscode.CodeActionKind.QuickFix.value);
        }
    });
});
