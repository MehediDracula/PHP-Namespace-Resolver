import * as vscode from 'vscode';

// Core
import { PhpClassDetector } from './core/PhpClassDetector';
import { DeclarationParser } from './core/DeclarationParser';
import { NamespaceCache } from './core/NamespaceCache';
import { NamespaceResolver } from './core/NamespaceResolver';
import { ImportManager } from './core/ImportManager';
import { SortManager } from './core/SortManager';
import { NamespaceGenerator } from './core/NamespaceGenerator';

// Features
import { ImportCommand } from './features/ImportCommand';
import { ExpandCommand } from './features/ExpandCommand';
import { SortCommand } from './features/SortCommand';
import { GenerateNamespaceCommand } from './features/GenerateNamespaceCommand';
import { HighlightManager } from './features/HighlightManager';
import { RemoveUnusedCommand } from './features/RemoveUnusedCommand';
import { DiagnosticManager } from './features/DiagnosticManager';
import { PhpCodeActionProvider } from './features/CodeActionProvider';

// Utils
import { getConfig } from './utils/config';

export function activate(context: vscode.ExtensionContext): void {
    // --- Core services ---
    const detector = new PhpClassDetector();
    const parser = new DeclarationParser();
    const cache = new NamespaceCache();
    const resolver = new NamespaceResolver(cache);
    const sortManager = new SortManager(parser);
    const importManager = new ImportManager(parser, (editor) => sortManager.sort(editor));
    const generator = new NamespaceGenerator(parser);

    // --- Feature handlers ---
    const importCommand = new ImportCommand(detector, parser, resolver, importManager);
    const expandCommand = new ExpandCommand(resolver, importManager);
    const sortCommand = new SortCommand(sortManager);
    const generateNsCommand = new GenerateNamespaceCommand(generator);
    const highlightManager = new HighlightManager(detector, parser);
    const removeUnusedCommand = new RemoveUnusedCommand(detector, parser);
    const diagnosticManager = new DiagnosticManager(detector, parser);

    // --- Initialize cache in background ---
    cache.initialize();

    // --- Register commands ---
    context.subscriptions.push(
        vscode.commands.registerCommand('namespaceResolver.import', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            for (const selection of editor.selections) {
                await importCommand.importSingle(selection);
            }
        }),

        vscode.commands.registerCommand('namespaceResolver.importAll', () => {
            return importCommand.importAll();
        }),

        vscode.commands.registerCommand('namespaceResolver.expand', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            for (const selection of editor.selections) {
                await expandCommand.expand(selection);
            }
        }),

        vscode.commands.registerCommand('namespaceResolver.sort', () => {
            sortCommand.execute();
        }),

        vscode.commands.registerCommand('namespaceResolver.highlightNotImported', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) { highlightManager.highlightNotImported(editor); }
        }),

        vscode.commands.registerCommand('namespaceResolver.highlightNotUsed', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) { highlightManager.highlightNotUsed(editor); }
        }),

        vscode.commands.registerCommand('namespaceResolver.generateNamespace', () => {
            return generateNsCommand.execute();
        }),

        vscode.commands.registerCommand('namespaceResolver.removeUnused', () => {
            return removeUnusedCommand.execute();
        }),

        vscode.commands.registerCommand('namespaceResolver.rebuildIndex', async () => {
            await cache.rebuild();
            vscode.window.showInformationMessage('PHP Namespace Resolver: Index rebuilt.');
        }),
    );

    // --- Register code action provider ---
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { language: 'php', scheme: 'file' },
            new PhpCodeActionProvider(),
            { providedCodeActionKinds: PhpCodeActionProvider.providedCodeActionKinds }
        )
    );

    // --- Event handlers ---

    // On save
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(event => {
            if (!event || event.document.languageId !== 'php') { return; }

            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.uri.toString() !== event.document.uri.toString()) { return; }

            if (getConfig('removeOnSave')) {
                removeUnusedCommand.removeUnused(editor);
            }

            if (getConfig('sortOnSave')) {
                sortCommand.execute();
            }

            if (getConfig('highlightOnSave')) {
                highlightManager.highlightNotImported(editor);
                highlightManager.highlightNotUsed(editor);
            }
        })
    );

    // On editor change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!editor || editor.document.languageId !== 'php') { return; }

            if (getConfig('highlightOnOpen')) {
                highlightManager.highlightNotImported(editor);
                highlightManager.highlightNotUsed(editor);
            }

            // Update diagnostics for the newly active document
            diagnosticManager.update(editor.document);
        })
    );

    // On document change (for diagnostics)
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId !== 'php') { return; }
            diagnosticManager.update(event.document);
        })
    );

    // On document close (clear diagnostics)
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            diagnosticManager.clear(document.uri);
        })
    );

    // --- Register disposables ---
    context.subscriptions.push(cache, highlightManager, diagnosticManager);

    // --- Initial diagnostics for already open editors ---
    if (vscode.window.activeTextEditor?.document.languageId === 'php') {
        diagnosticManager.update(vscode.window.activeTextEditor.document);
    }
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
