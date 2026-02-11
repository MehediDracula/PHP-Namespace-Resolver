import * as vscode from 'vscode';

/**
 * Create a TextDocument from PHP content string.
 */
export async function createDocument(content: string): Promise<vscode.TextDocument> {
    const doc = await vscode.workspace.openTextDocument({
        language: 'php',
        content,
    });
    return doc;
}

/**
 * Open a PHP document in an editor and return both.
 */
export async function openEditor(content: string): Promise<{
    editor: vscode.TextEditor;
    document: vscode.TextDocument;
}> {
    const document = await createDocument(content);
    const editor = await vscode.window.showTextDocument(document);
    return { editor, document };
}

/**
 * Get the full text of a document.
 */
export function getText(editor: vscode.TextEditor): string {
    return editor.document.getText();
}

/**
 * Wait for a short period to let VS Code process edits.
 */
export function wait(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
