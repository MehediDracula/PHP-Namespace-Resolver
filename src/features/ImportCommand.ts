import * as vscode from 'vscode';
import { PhpClassDetector } from '../core/PhpClassDetector';
import { DeclarationParser } from '../core/DeclarationParser';
import { NamespaceResolver } from '../core/NamespaceResolver';
import { ImportManager } from '../core/ImportManager';
import { requireActiveEditor, resolveClassName } from '../utils/editor';

export class ImportCommand {
    constructor(
        private detector: PhpClassDetector,
        private parser: DeclarationParser,
        private resolver: NamespaceResolver,
        private importManager: ImportManager
    ) {}

    async importSingle(selection: vscode.Selection | string): Promise<void> {
        const editor = requireActiveEditor();
        const resolving = resolveClassName(editor, selection);

        if (!resolving) {
            vscode.window.setStatusBarMessage('No class is selected.', 3000);
            return;
        }

        let fqcn: string | undefined;
        let replaceClassAfterImport = false;

        if (/\\/.test(resolving)) {
            fqcn = resolving.replace(/^\\?/, '');
            replaceClassAfterImport = true;
        } else {
            const namespaces = await this.resolver.resolve(resolving);

            if (namespaces.length === 0) {
                vscode.window.setStatusBarMessage('The class is not found.', 3000);
                return;
            }

            fqcn = await this.resolver.pickNamespace(namespaces);
        }

        if (!fqcn) { return; }

        await this.importManager.importClass(editor, selection, fqcn, replaceClassAfterImport);
    }

    async importAll(): Promise<void> {
        const editor = requireActiveEditor();
        const text = editor.document.getText();
        const detectedClasses = this.detector.detectAll(text);
        const importedClasses = this.parser.getImportedClassNames(editor.document);

        for (const phpClass of detectedClasses) {
            if (!importedClasses.includes(phpClass)) {
                await this.importSingle(phpClass);
                importedClasses.push(phpClass);
            }
        }
    }
}
