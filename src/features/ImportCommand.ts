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

    async importMultiple(selections: readonly vscode.Selection[]): Promise<void> {
        const editor = requireActiveEditor();

        const classMap = new Map<string, vscode.Selection[]>();
        for (const selection of selections) {
            const className = resolveClassName(editor, selection);
            if (!className) { continue; }
            const existing = classMap.get(className) ?? [];
            existing.push(selection);
            classMap.set(className, existing);
        }

        if (classMap.size === 0) {
            vscode.window.setStatusBarMessage('No class is selected.', 3000);
            return;
        }

        let importedCount = 0;

        for (const [className, classSelections] of classMap) {
            let fqcn: string | undefined;
            let replaceClassAfterImport = false;

            if (/\\/.test(className)) {
                fqcn = className.replace(/^\\?/, '');
                replaceClassAfterImport = true;
            } else {
                const namespaces = await this.resolver.resolve(className);
                if (namespaces.length === 0) { continue; }
                fqcn = await this.resolver.pickNamespace(namespaces);
            }

            if (!fqcn) { continue; }

            await this.importManager.importClass(editor, classSelections[0], fqcn, replaceClassAfterImport);
            importedCount++;
        }

        if (importedCount > 1) {
            vscode.window.setStatusBarMessage(`$(check)  Imported ${importedCount} class(es).`, 3000);
        }
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
