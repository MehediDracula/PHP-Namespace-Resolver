import * as vscode from 'vscode';
import { UseStatement, SortMode } from '../types';
import { DeclarationParser } from './DeclarationParser';
import { getConfig } from '../utils/config';

export class SortManager {
    constructor(private parser: DeclarationParser) {}

    sort(editor: vscode.TextEditor): Thenable<boolean> {
        const edits = this.computeSortEdits(editor.document);

        if (edits.length === 0) {
            throw new Error('Nothing to sort.');
        }

        return editor.edit(textEdit => {
            for (const edit of edits) {
                textEdit.replace(edit.range, edit.newText);
            }
        });
    }

    /**
     * Compute sort edits as TextEdit[] without applying them.
     * Returns empty array if nothing to sort.
     * Accepts optional pre-filtered statements (e.g. after removing unused).
     */
    computeSortEdits(document: vscode.TextDocument, stmts?: UseStatement[]): vscode.TextEdit[] {
        const { useStatements, declarationLines } = this.parser.parse(document);
        const target = stmts ?? useStatements;

        if (target.length <= 1) { return []; }

        const mode = getConfig('sortMode');

        const classStmts = this.sortStatements(target.filter(s => s.kind === 'class'), mode);
        const funcStmts = this.sortStatements(target.filter(s => s.kind === 'function'), mode);
        const constStmts = this.sortStatements(target.filter(s => s.kind === 'const'), mode);

        const groups = [classStmts, funcStmts, constStmts].filter(g => g.length > 0);
        // Deduplicate grouped imports (e.g. use App\{Foo, Bar}; produces multiple statements with the same line)
        const dedupe = (stmts: UseStatement[]) => {
            const seen = new Set<number>();
            return stmts.filter(s => {
                if (seen.has(s.line)) { return false; }
                seen.add(s.line);
                return true;
            });
        };
        const sortedLines = groups.map(g => dedupe(g).map(s => s.text).join('\n')).join('\n\n');

        // Replace the entire use block range (eliminates blank line gaps)
        const firstLine = declarationLines.firstUseStatement! - 1;
        const lastLine = declarationLines.lastUseStatement! - 1;
        const lastLineText = document.lineAt(lastLine).text;

        return [
            vscode.TextEdit.replace(
                new vscode.Range(firstLine, 0, lastLine, lastLineText.length),
                sortedLines
            )
        ];
    }

    private sortStatements(statements: UseStatement[], mode: SortMode): UseStatement[] {
        const sorted = [...statements];

        switch (mode) {
            case 'alphabetical':
                sorted.sort((a, b) => {
                    return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                });
                break;

            case 'natural':
                sorted.sort((a, b) => {
                    return naturalCompare(a.text, b.text);
                });
                break;

            case 'length':
            default:
                sorted.sort((a, b) => {
                    if (a.text.length === b.text.length) {
                        return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                    }
                    return a.text.length - b.text.length;
                });
                break;
        }

        return sorted;
    }
}

function naturalCompare(a: string, b: string): number {
    const aParts = a.split(/(\d+)/);
    const bParts = b.split(/(\d+)/);

    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        const aPart = aParts[i];
        const bPart = bParts[i];

        if (aPart === bPart) { continue; }

        const aNum = parseInt(aPart, 10);
        const bNum = parseInt(bPart, 10);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }

        return aPart.localeCompare(bPart);
    }

    return aParts.length - bParts.length;
}
