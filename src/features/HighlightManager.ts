import * as vscode from 'vscode';
import { PhpClassDetector } from '../core/PhpClassDetector';
import { DeclarationParser } from '../core/DeclarationParser';
import { getConfig } from '../utils/config';

/**
 * Manages visual highlighting of not-imported and not-used classes
 * with user-configurable colors.
 */
export class HighlightManager implements vscode.Disposable {
    private notImportedDecoration: vscode.TextEditorDecorationType | undefined;
    private notUsedDecoration: vscode.TextEditorDecorationType | undefined;

    constructor(
        private detector: PhpClassDetector,
        private parser: DeclarationParser
    ) {}

    /**
     * Highlight classes that are referenced but not imported.
     */
    highlightNotImported(editor: vscode.TextEditor): void {
        // Dispose previous decoration type to avoid stacking
        this.notImportedDecoration?.dispose();

        const text = editor.document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const importedClasses = this.parser.getImportedClassNames(editor.document);

        const notImported = detectedClasses.filter(cls => !importedClasses.includes(cls));

        const decorationOptions: vscode.DecorationOptions[] = [];

        for (const className of notImported) {
            const regex = new RegExp(`(?<![a-zA-Z0-9_\\\\])${escapeRegex(className)}(?![a-zA-Z0-9_\\\\])`, 'g');
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const startPos = editor.document.positionAt(match.index);
                const textLine = editor.document.lineAt(startPos);
                const charBefore = textLine.text.charAt(startPos.character - 1);

                // Skip if preceded by a word character (partial match) or on namespace line
                if (!/\w/.test(charBefore) && !/^\s*namespace\s/.test(textLine.text)) {
                    const endPos = editor.document.positionAt(match.index + match[0].length);
                    decorationOptions.push({
                        range: new vscode.Range(startPos, endPos),
                        hoverMessage: 'Class is not imported.',
                    });
                }
            }
        }

        const color = getConfig('highlightNotImportedColor');
        this.notImportedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            light: { borderColor: 'darkblue' },
            dark: { borderColor: 'lightblue' },
        });

        editor.setDecorations(this.notImportedDecoration, decorationOptions);
    }

    /**
     * Highlight imported classes that are not used in the code.
     */
    highlightNotUsed(editor: vscode.TextEditor): void {
        // Dispose previous decoration type to avoid stacking
        this.notUsedDecoration?.dispose();

        const text = editor.document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const importedClasses = this.parser.getImportedClassNames(editor.document);

        const notUsed = importedClasses.filter(cls => !detectedClasses.includes(cls));

        const decorationOptions: vscode.DecorationOptions[] = [];

        for (const className of notUsed) {
            const regex = new RegExp(escapeRegex(className), 'g');
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const startPos = editor.document.positionAt(match.index);
                const textLine = editor.document.lineAt(startPos);

                // Only highlight in use statement lines
                if (/^\s*use\s/.test(textLine.text)) {
                    const endPos = editor.document.positionAt(match.index + match[0].length);
                    decorationOptions.push({
                        range: new vscode.Range(startPos, endPos),
                        hoverMessage: 'Class is not used.',
                    });
                }
            }
        }

        const color = getConfig('highlightNotUsedColor');
        this.notUsedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            light: { borderColor: 'darkblue' },
            dark: { borderColor: 'lightblue' },
        });

        editor.setDecorations(this.notUsedDecoration, decorationOptions);
    }

    /**
     * Clear all highlights.
     */
    clearHighlights(): void {
        this.notImportedDecoration?.dispose();
        this.notUsedDecoration?.dispose();
        this.notImportedDecoration = undefined;
        this.notUsedDecoration = undefined;
    }

    dispose(): void {
        this.clearHighlights();
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
