import * as vscode from 'vscode';
import { DiagnosticCode } from '../types';

export class PhpCodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'PHP Namespace Resolver') {
                continue;
            }

            if (diagnostic.code === DiagnosticCode.ClassNotImported) {
                actions.push(...this.createImportActions(diagnostic));
            }

            if (diagnostic.code === DiagnosticCode.ClassNotUsed) {
                actions.push(...this.createRemoveActions(diagnostic));
            }
        }

        return actions;
    }

    private createImportActions(diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        const importAction = new vscode.CodeAction(
            `Import class`,
            vscode.CodeActionKind.QuickFix
        );
        importAction.command = {
            command: 'phpNamespaceResolver.import',
            title: 'Import Class',
        };
        importAction.diagnostics = [diagnostic];
        importAction.isPreferred = true;
        actions.push(importAction);

        const expandAction = new vscode.CodeAction(
            `Expand to fully qualified name`,
            vscode.CodeActionKind.QuickFix
        );
        expandAction.command = {
            command: 'phpNamespaceResolver.expand',
            title: 'Expand Class',
        };
        expandAction.diagnostics = [diagnostic];
        actions.push(expandAction);

        return actions;
    }

    private createRemoveActions(diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        const removeOneAction = new vscode.CodeAction(
            `Remove unused import`,
            vscode.CodeActionKind.QuickFix
        );
        removeOneAction.command = {
            command: 'phpNamespaceResolver.removeUnused',
            title: 'Remove Unused Imports',
        };
        removeOneAction.diagnostics = [diagnostic];
        removeOneAction.isPreferred = true;
        actions.push(removeOneAction);

        return actions;
    }
}
