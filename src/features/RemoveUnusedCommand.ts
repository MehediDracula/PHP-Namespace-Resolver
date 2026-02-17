import * as vscode from 'vscode';
import { PhpClassDetector } from '../core/PhpClassDetector';
import { DeclarationParser } from '../core/DeclarationParser';
import { requireActiveEditor } from '../utils/editor';
import { showStatusMessage } from '../utils/statusBar';

export class RemoveUnusedCommand {
    constructor(
        private detector: PhpClassDetector,
        private parser: DeclarationParser
    ) {}

    async execute(): Promise<void> {
        try {
            const editor = requireActiveEditor();
            const removed = await this.removeUnused(editor);
            if (removed > 0) {
                showStatusMessage(`$(check) Removed ${removed} unused import${removed > 1 ? 's' : ''}.`);
            } else {
                showStatusMessage('$(check) No unused imports found.');
            }
        } catch (error: any) {
            showStatusMessage(error.message);
        }
    }

    async removeUnused(editor: vscode.TextEditor): Promise<number> {
        const text = editor.document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const { useStatements } = this.parser.parse(editor.document);

        const unusedStatements = useStatements.filter(
            stmt => !detectedClasses.includes(stmt.className) &&
                !text.includes(`${stmt.className}\\`)
        );

        if (unusedStatements.length === 0) {
            return 0;
        }

        // Delete lines in reverse order to avoid shifting line numbers
        const sortedUnused = [...unusedStatements].sort((a, b) => b.line - a.line);

        await editor.edit(textEdit => {
            for (const stmt of sortedUnused) {
                const line = stmt.line;
                const range = editor.document.lineAt(line).rangeIncludingLineBreak;
                textEdit.delete(range);
            }
        });

        await this.cleanupBlankLines(editor);

        return unusedStatements.length;
    }

    private async cleanupBlankLines(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const linesToDelete: number[] = [];

        let inUseArea = false;
        let prevBlank = false;

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text.trim();

            if (text.startsWith('use ')) {
                inUseArea = true;
                prevBlank = false;
            } else if (inUseArea && text === '') {
                if (prevBlank) {
                    linesToDelete.push(line);
                }
                prevBlank = true;
            } else if (inUseArea && text !== '') {
                break;
            }
        }

        if (linesToDelete.length > 0) {
            await editor.edit(textEdit => {
                for (const line of linesToDelete.reverse()) {
                    textEdit.delete(document.lineAt(line).rangeIncludingLineBreak);
                }
            });
        }
    }
}
