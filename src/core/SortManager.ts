import * as vscode from 'vscode';
import { UseStatement, SortMode } from '../types';
import { DeclarationParser } from './DeclarationParser';
import { getSortMode } from '../utils/config';

/**
 * Handles sorting of PHP use statements with multiple sorting strategies.
 */
export class SortManager {
    constructor(private parser: DeclarationParser) {}

    /**
     * Sort imports in the given editor. Throws if nothing to sort.
     */
    sort(editor: vscode.TextEditor): void {
        const { useStatements } = this.parser.parse(editor.document);

        if (useStatements.length <= 1) {
            throw new Error('Nothing to sort.');
        }

        const mode = getSortMode();
        const sorted = this.sortStatements(useStatements, mode);

        editor.edit(textEdit => {
            for (let i = 0; i < sorted.length; i++) {
                const original = useStatements[i];
                textEdit.replace(
                    new vscode.Range(original.line, 0, original.line, original.text.length),
                    sorted[i].text
                );
            }
        });
    }

    /**
     * Sort an array of use statements according to the given mode.
     */
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

/**
 * Natural sort comparison that handles embedded numbers intelligently.
 */
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
