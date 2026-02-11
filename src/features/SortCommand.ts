import * as vscode from 'vscode';
import { SortManager } from '../core/SortManager';
import { requireActiveEditor } from '../utils/editor';

export class SortCommand {
    constructor(private sortManager: SortManager) {}

    execute(): void {
        try {
            const editor = requireActiveEditor();
            this.sortManager.sort(editor);
            vscode.window.setStatusBarMessage('$(check)  Imports are sorted.', 3000);
        } catch (error: any) {
            vscode.window.setStatusBarMessage(error.message, 3000);
        }
    }
}
