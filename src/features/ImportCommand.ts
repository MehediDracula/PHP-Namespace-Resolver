import * as vscode from 'vscode';
import { PhpClassDetector } from '../core/PhpClassDetector';
import { DeclarationParser } from '../core/DeclarationParser';
import { NamespaceResolver } from '../core/NamespaceResolver';
import { ImportManager } from '../core/ImportManager';
import { requireActiveEditor, resolveClassName } from '../utils/editor';
import { showError } from '../utils/messages';

/**
 * Handles the Import Class and Import All Classes commands.
 */
export class ImportCommand {
    constructor(
        private detector: PhpClassDetector,
        private parser: DeclarationParser,
        private resolver: NamespaceResolver,
        private importManager: ImportManager
    ) {}

    /**
     * Import a single class at the cursor position (or from a string).
     */
    async importSingle(selection: vscode.Selection | string): Promise<void> {
        const editor = requireActiveEditor();
        const resolving = resolveClassName(editor, selection);

        if (!resolving) {
            return showError('No class is selected.');
        }

        let fqcn: string | undefined;
        let replaceClassAfterImport = false;

        if (/\\/.test(resolving)) {
            // User selected a FQCN — import it directly
            fqcn = resolving.replace(/^\\?/, '');
            replaceClassAfterImport = true;
        } else {
            const namespaces = await this.resolver.resolve(resolving);

            if (namespaces.length === 0) {
                return showError('The class is not found.');
            }

            fqcn = await this.resolver.pickNamespace(namespaces);
        }

        if (!fqcn) { return; }

        await this.importManager.importClass(editor, selection, fqcn, replaceClassAfterImport);
    }

    /**
     * Import all unimported classes detected in the current file.
     */
    async importAll(): Promise<void> {
        const editor = requireActiveEditor();
        const text = editor.document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const importedClasses = this.parser.getImportedClassNames(editor.document);

        for (const phpClass of detectedClasses) {
            if (!importedClasses.includes(phpClass)) {
                await this.importSingle(phpClass);
                // Refresh imported list after each import
                importedClasses.push(phpClass);
            }
        }
    }
}
