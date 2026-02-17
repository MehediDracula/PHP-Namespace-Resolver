import * as vscode from 'vscode';

import { PhpClassDetector } from './core/PhpClassDetector';
import { DeclarationParser } from './core/DeclarationParser';
import { NamespaceCache } from './core/NamespaceCache';
import { NamespaceResolver } from './core/NamespaceResolver';
import { ImportManager } from './core/ImportManager';
import { SortManager } from './core/SortManager';
import { NamespaceGenerator } from './core/NamespaceGenerator';
import { ImportCommand } from './features/ImportCommand';
import { ExpandCommand } from './features/ExpandCommand';
import { SortCommand } from './features/SortCommand';
import { GenerateNamespaceCommand } from './features/GenerateNamespaceCommand';

import { RemoveUnusedCommand } from './features/RemoveUnusedCommand';
import { DiagnosticManager } from './features/DiagnosticManager';
import { PhpCodeActionProvider } from './features/CodeActionProvider';
import { getConfig } from './utils/config';
import { showStatusMessage, disposeStatusBar } from './utils/statusBar';

export function activate(context: vscode.ExtensionContext): void {
    const detector = new PhpClassDetector();
    const parser = new DeclarationParser();
    const cache = new NamespaceCache(context.storageUri);
    const resolver = new NamespaceResolver(cache);
    const sortManager = new SortManager(parser);
    const importManager = new ImportManager(parser, (editor) => sortManager.sort(editor));
    const generator = new NamespaceGenerator(parser);

    const importCommand = new ImportCommand(detector, parser, resolver, importManager);
    const expandCommand = new ExpandCommand(resolver, importManager);
    const sortCommand = new SortCommand(sortManager);
    const generateNsCommand = new GenerateNamespaceCommand(generator);
    const removeUnusedCommand = new RemoveUnusedCommand(detector, parser);
    const diagnosticManager = new DiagnosticManager(detector, parser, cache);

    cache.initialize();

    context.subscriptions.push(
        vscode.commands.registerCommand('phpNamespaceResolver.import', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            if (editor.selections.length === 1) {
                await importCommand.importSingle(editor.selections[0]);
            } else {
                await importCommand.importMultiple(editor.selections);
            }
        }),

        vscode.commands.registerCommand('phpNamespaceResolver.importAll', () => {
            return importCommand.importAll();
        }),

        vscode.commands.registerCommand('phpNamespaceResolver.expand', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            if (editor.selections.length === 1) {
                await expandCommand.expand(editor.selections[0]);
            } else {
                await expandCommand.expandMultiple(editor.selections);
            }
        }),

        vscode.commands.registerCommand('phpNamespaceResolver.sort', () => {
            sortCommand.execute();
        }),

        vscode.commands.registerCommand('phpNamespaceResolver.generateNamespace', () => {
            return generateNsCommand.execute();
        }),

        vscode.commands.registerCommand('phpNamespaceResolver.removeUnused', () => {
            return removeUnusedCommand.execute();
        }),

        vscode.commands.registerCommand('phpNamespaceResolver.rebuildIndex', async () => {
            await cache.rebuild();
            showStatusMessage('$(check) PHP Namespace Resolver: Index rebuilt.');
        }),
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { language: 'php', scheme: 'file' },
            new PhpCodeActionProvider(),
            { providedCodeActionKinds: PhpCodeActionProvider.providedCodeActionKinds }
        )
    );

    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(event => {
            if (!event || event.document.languageId !== 'php') { return; }

            const needsRemove = getConfig('removeOnSave');
            const needsSort = getConfig('sortOnSave');
            if (!needsRemove && !needsSort) { return; }

            diagnosticManager.suppressUpdates = true;

            event.waitUntil(((): Promise<vscode.TextEdit[]> => {
                try {
                    const document = event.document;
                    const { useStatements } = parser.parse(document);
                    if (useStatements.length === 0) { return Promise.resolve([]); }

                    let stmtsToKeep = useStatements;

                    // Filter out unused class imports
                    if (needsRemove) {
                        const text = document.getText();
                        const detectedClasses = detector.detectAll(text);
                        const ignoreList = getConfig('ignoreList');
                        stmtsToKeep = useStatements.filter(stmt => {
                            if (stmt.kind !== 'class') { return true; }
                            if (ignoreList.includes(stmt.className)) { return true; }
                            if (detectedClasses.includes(stmt.className)) { return true; }
                            if (text.includes(`${stmt.className}\\`)) { return true; }
                            return false;
                        });
                    }

                    // Sort remaining imports (or just sort without remove)
                    if (needsSort && stmtsToKeep.length > 1) {
                        return Promise.resolve(sortManager.computeSortEdits(document, stmtsToKeep));
                    }

                    // Remove-only: delete unused lines (reverse order for stable line numbers)
                    if (needsRemove && stmtsToKeep.length < useStatements.length) {
                        const removed = useStatements.filter(s => !stmtsToKeep.includes(s));
                        const edits = removed
                            .sort((a, b) => b.line - a.line)
                            .map(stmt => vscode.TextEdit.delete(document.lineAt(stmt.line).rangeIncludingLineBreak));
                        return Promise.resolve(edits);
                    }

                    return Promise.resolve([]);
                } finally {
                    // Defer re-enabling so diagnostics don't fire during the save edit application
                    setTimeout(() => { diagnosticManager.suppressUpdates = false; }, 100);
                }
            })());
        })
    );

    context.subscriptions.push(cache, diagnosticManager);
}

export function deactivate(): void {
    disposeStatusBar();
}
