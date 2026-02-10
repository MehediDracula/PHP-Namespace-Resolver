import * as vscode from 'vscode';
import { NamespaceResolver } from '../core/NamespaceResolver';
import { ImportManager } from '../core/ImportManager';
import { requireActiveEditor, resolveClassName } from '../utils/editor';
import { showError } from '../utils/messages';

/**
 * Handles the Expand Class command — replaces a short class name with its FQCN inline.
 */
export class ExpandCommand {
    constructor(
        private resolver: NamespaceResolver,
        private importManager: ImportManager
    ) {}

    async expand(selection: vscode.Selection): Promise<void> {
        const editor = requireActiveEditor();
        const resolving = resolveClassName(editor, selection);

        if (!resolving) {
            return showError('No class is selected.');
        }

        const namespaces = await this.resolver.resolve(resolving);

        if (namespaces.length === 0) {
            return showError('The class is not found.');
        }

        const fqcn = await this.resolver.pickNamespace(namespaces);
        if (!fqcn) { return; }

        await this.importManager.changeSelectedClass(editor, selection, fqcn, true);
    }
}
