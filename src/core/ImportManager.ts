import * as vscode from 'vscode';
import { UseStatement, DeclarationLines, InsertPosition } from '../types';
import { DeclarationParser } from './DeclarationParser';
import { getConfig } from '../utils/config';
import { showMessage, showError } from '../utils/messages';

/**
 * Manages the insertion, replacement, and conflict resolution of PHP use statements.
 */
export class ImportManager {
    constructor(
        private parser: DeclarationParser,
        private sortCallback: (editor: vscode.TextEditor) => void
    ) {}

    /**
     * Import a fully qualified class name into the active document.
     * Handles conflict detection and alias resolution.
     */
    async importClass(
        editor: vscode.TextEditor,
        selection: vscode.Selection | string,
        fqcn: string,
        replaceClassAfterImport: boolean = false
    ): Promise<void> {
        let result: { useStatements: UseStatement[]; declarationLines: DeclarationLines };

        try {
            result = this.parser.parse(editor.document, fqcn);
        } catch (error: any) {
            showError(error.message);
            return;
        }

        const classBaseName = fqcn.match(/(\w+)/g)?.pop();
        if (!classBaseName) { return; }

        if (this.hasConflict(result.useStatements, classBaseName)) {
            await this.insertAsAlias(editor, selection, fqcn, result.useStatements, result.declarationLines);
        } else if (replaceClassAfterImport) {
            await this.importAndReplaceSelectedClass(editor, selection, classBaseName, fqcn, result.declarationLines);
        } else {
            await this.insert(editor, fqcn, result.declarationLines);
        }
    }

    /**
     * Insert a use statement at the appropriate location.
     */
    async insert(
        editor: vscode.TextEditor,
        fqcn: string,
        declarationLines: DeclarationLines,
        alias: string | null = null
    ): Promise<void> {
        const pos = this.parser.getInsertPosition(declarationLines);
        const aliasStr = alias ? ` as ${alias}` : '';
        const statement = `${pos.prepend}use ${fqcn}${aliasStr};${pos.append}`;

        await editor.edit(textEdit => {
            textEdit.replace(new vscode.Position(pos.line, 0), statement);
        });

        if (getConfig('autoSort')) {
            this.sortCallback(editor);
        }

        showMessage('$(check)  The class is imported.');
    }

    /**
     * Check if a class name conflicts with an existing import.
     */
    hasConflict(useStatements: UseStatement[], className: string): boolean {
        return useStatements.some(stmt => stmt.className === className);
    }

    /**
     * Prompt for an alias and insert with that alias.
     */
    private async insertAsAlias(
        editor: vscode.TextEditor,
        selection: vscode.Selection | string,
        fqcn: string,
        useStatements: UseStatement[],
        declarationLines: DeclarationLines
    ): Promise<void> {
        const alias = await vscode.window.showInputBox({
            placeHolder: 'Enter an alias or leave it empty to replace',
        });

        if (alias === undefined) {
            return; // User cancelled
        }

        if (this.hasConflict(useStatements, alias)) {
            showError('This alias is already in use.');
            return this.insertAsAlias(editor, selection, fqcn, useStatements, declarationLines);
        }

        if (alias !== '') {
            await this.importAndReplaceSelectedClass(editor, selection, alias, fqcn, declarationLines, alias);
        } else {
            await this.replaceUseStatement(editor, fqcn, useStatements);
        }
    }

    /**
     * Replace an existing use statement that has a conflicting class name.
     */
    private async replaceUseStatement(
        editor: vscode.TextEditor,
        fqcn: string,
        useStatements: UseStatement[]
    ): Promise<void> {
        const baseName = fqcn.split('\\').pop();
        const existing = useStatements.find(stmt => stmt.className === baseName);

        if (!existing) { return; }

        await editor.edit(textEdit => {
            textEdit.replace(
                new vscode.Range(existing.line, 0, existing.line, existing.text.length),
                `use ${fqcn};`
            );
        });

        if (getConfig('autoSort')) {
            this.sortCallback(editor);
        }
    }

    /**
     * Import a class and simultaneously replace the selected text in the editor.
     */
    private async importAndReplaceSelectedClass(
        editor: vscode.TextEditor,
        selection: vscode.Selection | string,
        replacingClassName: string,
        fqcn: string,
        declarationLines: DeclarationLines,
        alias: string | null = null
    ): Promise<void> {
        if (typeof selection !== 'string') {
            await this.changeSelectedClass(editor, selection, replacingClassName, false);
        }
        await this.insert(editor, fqcn, declarationLines, alias);
    }

    /**
     * Replace the word at the cursor position with a different class name or FQCN.
     */
    async changeSelectedClass(
        editor: vscode.TextEditor,
        selection: vscode.Selection,
        fqcn: string,
        prependBackslash: boolean
    ): Promise<void> {
        const wordRange = editor.document.getWordRangeAtPosition(
            selection.active,
            /[a-zA-Z0-9\\]+/
        );

        if (!wordRange) { return; }

        const prefix = prependBackslash && getConfig('leadingSeparator') ? '\\' : '';

        await editor.edit(textEdit => {
            textEdit.replace(wordRange, prefix + fqcn);
        });

        const newPos = new vscode.Position(selection.active.line, selection.active.character);
        editor.selection = new vscode.Selection(newPos, newPos);
    }
}
