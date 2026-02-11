import * as vscode from 'vscode';
import { NamespaceResolver } from '../core/NamespaceResolver';
import { ImportManager } from '../core/ImportManager';
import { requireActiveEditor, resolveClassName } from '../utils/editor';

export class ExpandCommand {
    constructor(
        private resolver: NamespaceResolver,
        private importManager: ImportManager
    ) {}

    async expandMultiple(selections: readonly vscode.Selection[]): Promise<void> {
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

        const resolved = new Map<string, string>();
        for (const className of classMap.keys()) {
            const namespaces = await this.resolver.resolve(className);
            if (namespaces.length === 0) { continue; }
            const fqcn = await this.resolver.pickNamespace(namespaces);
            if (fqcn) {
                resolved.set(className, fqcn);
            }
        }

        if (resolved.size === 0) { return; }

        const replacements: { selection: vscode.Selection; fqcn: string }[] = [];
        for (const [className, classSelections] of classMap) {
            const fqcn = resolved.get(className);
            if (!fqcn) { continue; }
            for (const selection of classSelections) {
                replacements.push({ selection, fqcn });
            }
        }

        if (replacements.length === 0) { return; }

        await this.importManager.changeMultipleSelectedClasses(editor, replacements, true);
    }

    async expand(selection: vscode.Selection): Promise<void> {
        const editor = requireActiveEditor();
        const resolving = resolveClassName(editor, selection);

        if (!resolving) {
            vscode.window.setStatusBarMessage('No class is selected.', 3000);
            return;
        }

        const namespaces = await this.resolver.resolve(resolving);

        if (namespaces.length === 0) {
            vscode.window.setStatusBarMessage('The class is not found.', 3000);
            return;
        }

        const fqcn = await this.resolver.pickNamespace(namespaces);
        if (!fqcn) { return; }

        await this.importManager.changeSelectedClass(editor, selection, fqcn, true);
    }
}
