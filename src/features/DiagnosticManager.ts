import * as vscode from 'vscode';
import { PhpClassDetector } from '../core/PhpClassDetector';
import { DeclarationParser } from '../core/DeclarationParser';
import { NamespaceCache } from '../core/NamespaceCache';
import { DiagnosticCode, UseStatement } from '../types';
import { builtInClasses } from '../data/builtInClasses';

const DIAGNOSTIC_SOURCE = 'PHP Namespace Resolver';

export class DiagnosticManager implements vscode.Disposable {
    private collection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private detector: PhpClassDetector,
        private parser: DeclarationParser,
        private cache: NamespaceCache
    ) {
        this.collection = vscode.languages.createDiagnosticCollection('phpNamespaceResolver');

        this.disposables.push(
            cache.onDidFinishIndexing(() => this.refreshVisible()),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (!editor || editor.document.languageId !== 'php') { return; }
                this.update(editor.document);
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId !== 'php') { return; }
                clearTimeout(this.debounceTimer);
                const doc = event.document;
                this.debounceTimer = setTimeout(() => this.update(doc), 300);
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                this.clear(document.uri);
            })
        );
    }

    refreshVisible(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.languageId === 'php') {
                this.update(editor.document);
            }
        }
    }

    update(document: vscode.TextDocument): void {
        if (document.languageId !== 'php') {
            this.collection.delete(document.uri);
            return;
        }

        const text = document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const { useStatements } = this.parser.parse(document);

        const diagnostics: vscode.Diagnostic[] = [];

        if (this.cache.indexed) {
            const importedClasses = useStatements.map(s => s.className);
            const currentNamespace = this.parser.getNamespace(document);
            const declaredClasses = this.parser.getDeclaredClassNames(document);
            diagnostics.push(...this.getNotImportedDiagnostics(document, text, detectedClasses, importedClasses, currentNamespace, declaredClasses));
        }
        diagnostics.push(...this.getNotUsedDiagnostics(document, text, detectedClasses, useStatements));

        this.collection.set(document.uri, diagnostics);
    }

    getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
        return this.collection.get(uri) ?? [];
    }

    clear(uri: vscode.Uri): void {
        this.collection.delete(uri);
    }

    clearAll(): void {
        this.collection.clear();
    }

    dispose(): void {
        clearTimeout(this.debounceTimer);
        this.disposables.forEach(d => d.dispose());
        this.collection.dispose();
    }

    private isInSameNamespace(className: string, currentNamespace: string | null): boolean {
        if (!currentNamespace) {
            return builtInClasses.has(className);
        }

        const entries = this.cache.lookup(className);
        return entries.some(e => e.fqcn === `${currentNamespace}\\${className}`);
    }

    private getNotImportedDiagnostics(
        document: vscode.TextDocument,
        text: string,
        detectedClasses: string[],
        importedClasses: string[],
        currentNamespace: string | null,
        declaredClasses: string[]
    ): vscode.Diagnostic[] {
        const notImported = detectedClasses.filter(cls =>
            !importedClasses.includes(cls) &&
            !declaredClasses.includes(cls) &&
            !this.isInSameNamespace(cls, currentNamespace)
        );

        const commentRanges = getCommentRanges(text);
        const diagnostics: vscode.Diagnostic[] = [];

        for (const className of notImported) {
            const regex = new RegExp(
                `(?<![a-zA-Z0-9_\\\\])${escapeRegex(className)}(?![a-zA-Z0-9_\\\\])`,
                'g'
            );
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                if (isInsideComment(match.index, commentRanges)) {
                    continue;
                }

                const startPos = document.positionAt(match.index);
                const textLine = document.lineAt(startPos);

                if (/^(?:namespace|use)\s/.test(textLine.text)) {
                    continue;
                }

                // Skip matches inside comments (not PHPDoc — handled by isInsideComment above)
                const trimmedLine = textLine.text.trimStart();
                if (
                    trimmedLine.startsWith('//') ||
                    (trimmedLine.startsWith('/*') && !trimmedLine.startsWith('/**')) ||
                    (trimmedLine.startsWith('#') && !trimmedLine.startsWith('#['))
                ) {
                    continue;
                }
                const textBeforeMatch = textLine.text.substring(0, startPos.character);
                if (textBeforeMatch.includes('//')) {
                    continue;
                }

                const charBefore = textLine.text.charAt(startPos.character - 1);
                if (/\w/.test(charBefore)) {
                    continue;
                }

                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                const diag = new vscode.Diagnostic(
                    range,
                    `Class '${className}' is not imported.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = DiagnosticCode.ClassNotImported;
                diag.source = DIAGNOSTIC_SOURCE;
                diagnostics.push(diag);
            }
        }

        return diagnostics;
    }

    private getNotUsedDiagnostics(
        document: vscode.TextDocument,
        text: string,
        detectedClasses: string[],
        useStatements: UseStatement[]
    ): vscode.Diagnostic[] {

        const diagnostics: vscode.Diagnostic[] = [];

        for (const stmt of useStatements) {
            if (!detectedClasses.includes(stmt.className) &&
                !text.includes(`${stmt.className}\\`)) {
                const lineText = document.lineAt(stmt.line).text;
                const startChar = lineText.lastIndexOf(stmt.className);
                const range = new vscode.Range(
                    stmt.line, Math.max(0, startChar),
                    stmt.line, Math.max(0, startChar) + stmt.className.length
                );

                const diag = new vscode.Diagnostic(
                    range,
                    `Imported class '${stmt.className}' is not used.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = DiagnosticCode.ClassNotUsed;
                diag.source = DIAGNOSTIC_SOURCE;
                diag.tags = [vscode.DiagnosticTag.Unnecessary];
                diagnostics.push(diag);
            }
        }

        return diagnostics;
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type CommentRange = [start: number, end: number];

function getCommentRanges(text: string): CommentRange[] {
    const ranges: CommentRange[] = [];
    const regex = /\/\/[^\n]*|\/\*(?!\*)[\s\S]*?\*\/|#(?!\[)[^\n]*/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        ranges.push([match.index, match.index + match[0].length]);
    }
    return ranges;
}

function isInsideComment(offset: number, ranges: CommentRange[]): boolean {
    for (const [start, end] of ranges) {
        if (offset >= start && offset < end) { return true; }
        if (start > offset) { break; }
    }
    return false;
}
