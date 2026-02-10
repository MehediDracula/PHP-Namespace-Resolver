import * as vscode from 'vscode';
import { DiagnosticCode } from '../types';

/**
 * Provides code actions (quick fixes) for PHP namespace diagnostics.
 *
 * When the cursor is on an unimported class:
 *   - Offers "Import Class" action
 *   - Offers "Expand to FQCN" action
 *
 * When the cursor is on an unused import:
 *   - Offers "Remove unused import" action
 *   - Offers "Remove all unused imports" action
 */
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

        // Import Class action
        const importAction = new vscode.CodeAction(
            `Import class`,
            vscode.CodeActionKind.QuickFix
        );
        importAction.command = {
            command: 'namespaceResolver.import',
            title: 'Import Class',
        };
        importAction.diagnostics = [diagnostic];
        importAction.isPreferred = true;
        actions.push(importAction);

        // Expand to FQCN action
        const expandAction = new vscode.CodeAction(
            `Expand to fully qualified name`,
            vscode.CodeActionKind.QuickFix
        );
        expandAction.command = {
            command: 'namespaceResolver.expand',
            title: 'Expand Class',
        };
        expandAction.diagnostics = [diagnostic];
        actions.push(expandAction);

        return actions;
    }

    private createRemoveActions(diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // Remove this unused import
        const removeOneAction = new vscode.CodeAction(
            `Remove unused import`,
            vscode.CodeActionKind.QuickFix
        );
        removeOneAction.command = {
            command: 'namespaceResolver.removeUnused',
            title: 'Remove Unused Imports',
        };
        removeOneAction.diagnostics = [diagnostic];
        removeOneAction.isPreferred = true;
        actions.push(removeOneAction);

        return actions;
    }
}
