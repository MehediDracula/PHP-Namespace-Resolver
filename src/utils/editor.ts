import * as vscode from 'vscode';

const WORD_WITH_NAMESPACE = /[a-zA-Z0-9\\]+/;

export function getActiveEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
}

export function requireActiveEditor(): vscode.TextEditor {
    const editor = getActiveEditor();
    if (!editor) {
        throw new Error('No active editor.');
    }
    return editor;
}

export function getWordAtSelection(
    editor: vscode.TextEditor,
    selection: vscode.Selection
): string | undefined {
    const wordRange = editor.document.getWordRangeAtPosition(
        selection.active,
        WORD_WITH_NAMESPACE
    );
    if (!wordRange) {
        return undefined;
    }
    return editor.document.getText(wordRange);
}

export function getWordRangeAtSelection(
    editor: vscode.TextEditor,
    selection: vscode.Selection
): vscode.Range | undefined {
    return editor.document.getWordRangeAtPosition(
        selection.active,
        WORD_WITH_NAMESPACE
    );
}

/**
 * Resolve what class name is being targeted.
 * If `selection` is a string (from importAll), use it directly.
 * If it's a Selection, read the word at cursor.
 */
export function resolveClassName(
    editor: vscode.TextEditor,
    selection: vscode.Selection | string
): string | undefined {
    if (typeof selection === 'string') {
        return selection;
    }
    return getWordAtSelection(editor, selection);
}
