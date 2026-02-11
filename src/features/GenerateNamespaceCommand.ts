import * as vscode from 'vscode';
import { NamespaceGenerator } from '../core/NamespaceGenerator';
import { requireActiveEditor } from '../utils/editor';

/**
 * Handles the Generate Namespace command.
 */
export class GenerateNamespaceCommand {
    constructor(private generator: NamespaceGenerator) {}

    async execute(): Promise<void> {
        try {
            const editor = requireActiveEditor();
            await this.generator.generate(editor);
        } catch (error: any) {
            vscode.window.setStatusBarMessage(error.message, 3000);
        }
    }
}
