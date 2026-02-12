import * as vscode from 'vscode';
import { PhpClassDetector } from '../core/PhpClassDetector';
import { DeclarationParser } from '../core/DeclarationParser';
import { NamespaceCache } from '../core/NamespaceCache';
import { DiagnosticCode } from '../types';

const DIAGNOSTIC_SOURCE = 'PHP Namespace Resolver';

export class DiagnosticManager implements vscode.Disposable {
    private collection: vscode.DiagnosticCollection;

    constructor(
        private detector: PhpClassDetector,
        private parser: DeclarationParser,
        private cache: NamespaceCache
    ) {
        this.collection = vscode.languages.createDiagnosticCollection('phpNamespaceResolver');
    }

    update(document: vscode.TextDocument): void {
        if (document.languageId !== 'php') {
            this.collection.delete(document.uri);
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];

        diagnostics.push(...this.getNotImportedDiagnostics(document));
        diagnostics.push(...this.getNotUsedDiagnostics(document));

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
        this.collection.dispose();
    }

    private isInSameNamespace(className: string, currentNamespace: string | null): boolean {
        if (!currentNamespace) { return false; }
        const entries = this.cache.lookup(className);
        return entries.some(e => e.fqcn === `${currentNamespace}\\${className}`);
    }

    private getNotImportedDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const text = document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const importedClasses = this.parser.getImportedClassNames(document);
        const currentNamespace = this.parser.getNamespace(document);
        const declaredClasses = this.parser.getDeclaredClassNames(document);
        const notImported = detectedClasses.filter(cls =>
            !importedClasses.includes(cls) &&
            !declaredClasses.includes(cls) &&
            !this.isInSameNamespace(cls, currentNamespace)
        );

        const diagnostics: vscode.Diagnostic[] = [];

        for (const className of notImported) {
            const regex = new RegExp(
                `(?<![a-zA-Z0-9_\\\\])${escapeRegex(className)}(?![a-zA-Z0-9_\\\\])`,
                'g'
            );
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const textLine = document.lineAt(startPos);

                if (/^\s*(namespace|use)\s/.test(textLine.text)) {
                    continue;
                }

                // Skip matches inside comments
                const trimmedLine = textLine.text.trimStart();
                if (
                    trimmedLine.startsWith('//') ||
                    trimmedLine.startsWith('/*') ||
                    trimmedLine.startsWith('*') ||
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

                // Only report first occurrence per class
                break;
            }
        }

        return diagnostics;
    }

    private getNotUsedDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const text = document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const { useStatements } = this.parser.parse(document);

        const diagnostics: vscode.Diagnostic[] = [];

        for (const stmt of useStatements) {
            if (!detectedClasses.includes(stmt.className) &&
                !text.includes(`${stmt.className}\\`)) {
                const lineText = document.lineAt(stmt.line).text;
                const startChar = lineText.indexOf(stmt.className);
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
