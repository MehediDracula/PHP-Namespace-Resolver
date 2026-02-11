import * as vscode from 'vscode';
import { ComposerAutoload, PsrMapping } from '../types';
import { DeclarationParser } from './DeclarationParser';

/**
 * Generates PHP namespace declarations based on composer.json PSR-4 and PSR-0 autoload mappings.
 */
export class NamespaceGenerator {
    constructor(private parser: DeclarationParser) {}

    /**
     * Generate and insert/replace the namespace for the current file.
     */
    async generate(editor: vscode.TextEditor): Promise<void> {
        const currentUri = editor.document.uri;
        const currentFile = currentUri.fsPath;
        const currentPath = currentFile.substring(0, currentFile.lastIndexOf('/'));

        // Normalize for Windows
        const normalizedCurrentPath = currentPath.replace(/\\/g, '/');
        const normalizedCurrentFile = currentFile.replace(/\\/g, '/');

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentUri);
        if (!workspaceFolder) {
            return void vscode.window.setStatusBarMessage('No folder opened in workspace, cannot find composer.json', 3000);
        }

        // Search for composer.json recursively up from the current file
        const composerFile = await this.findComposerJson(normalizedCurrentFile, workspaceFolder);
        if (!composerFile) {
            return void vscode.window.setStatusBarMessage('No composer.json file found, automatic namespace generation failed', 3000);
        }

        const composerDoc = await vscode.workspace.openTextDocument(composerFile);
        const composerJson = JSON.parse(composerDoc.getText());
        const autoload = this.parseAutoload(composerJson);

        if (autoload.psr4.length === 0 && autoload.psr0.length === 0) {
            return void vscode.window.setStatusBarMessage('No psr-4 or psr-0 key in composer.json autoload, automatic namespace generation failed', 3000);
        }

        const composerDir = composerFile.fsPath.replace(/\\/g, '/').replace(/\/composer\.json$/, '');
        const relativePath = normalizedCurrentPath.substring(composerDir.length);

        const namespace = this.resolveNamespace(relativePath, autoload);
        if (!namespace) {
            return void vscode.window.setStatusBarMessage('Could not resolve namespace from composer.json autoload configuration', 3000);
        }

        const namespaceStatement = `namespace ${namespace};\n`;

        let declarationLines;
        try {
            ({ declarationLines } = this.parser.parse(editor.document));
        } catch (error: any) {
            return void vscode.window.setStatusBarMessage(error.message, 3000);
        }

        if (declarationLines.namespace !== null) {
            await this.replaceNamespaceStatement(editor, namespaceStatement, declarationLines.namespace);
        } else {
            await editor.edit(textEdit => {
                textEdit.insert(new vscode.Position(1, 0), '\n' + namespaceStatement);
            });
        }
    }

    /**
     * Search recursively upward for composer.json starting from the file's directory.
     */
    private async findComposerJson(
        filePath: string,
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<vscode.Uri | null> {
        let searchPath = filePath;
        const workspaceRoot = workspaceFolder.uri.fsPath.replace(/\\/g, '/');

        do {
            searchPath = searchPath.substring(0, searchPath.lastIndexOf('/'));
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(searchPath, 'composer.json')
            );
            if (files.length > 0) {
                return files[0];
            }
        } while (searchPath !== workspaceRoot && searchPath.includes('/'));

        return null;
    }

    /**
     * Parse composer.json autoload sections into normalized PsrMapping arrays.
     */
    private parseAutoload(composerJson: any): ComposerAutoload {
        const psr4: PsrMapping[] = [];
        const psr0: PsrMapping[] = [];

        const autoload = composerJson.autoload || {};
        const autoloadDev = composerJson['autoload-dev'] || {};

        // PSR-4
        const psr4Config = { ...autoload['psr-4'], ...autoloadDev['psr-4'] };
        for (const [ns, paths] of Object.entries(psr4Config)) {
            const normalizedPaths = Array.isArray(paths) ? paths : [paths as string];
            psr4.push({
                namespace: ns.replace(/\\$/, ''),
                paths: normalizedPaths.map(p => p.replace(/\/$/, '')),
            });
        }

        // PSR-0
        const psr0Config = { ...autoload['psr-0'], ...autoloadDev['psr-0'] };
        for (const [ns, paths] of Object.entries(psr0Config)) {
            const normalizedPaths = Array.isArray(paths) ? paths : [paths as string];
            psr0.push({
                namespace: ns.replace(/\\$/, ''),
                paths: normalizedPaths.map(p => p.replace(/\/$/, '')),
            });
        }

        return { psr4, psr0 };
    }

    /**
     * Resolve a namespace from the relative file path using PSR-4 or PSR-0 mappings.
     */
    private resolveNamespace(relativePath: string, autoload: ComposerAutoload): string | null {
        // Ensure the path ends with /
        const normalizedRelPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';

        // Try PSR-4 first
        for (const mapping of autoload.psr4) {
            for (const basePath of mapping.paths) {
                const normalizedBasePath = '/' + basePath + '/';
                const idx = normalizedRelPath.indexOf(normalizedBasePath);

                if (idx !== -1) {
                    const remaining = normalizedRelPath.substring(idx + normalizedBasePath.length);
                    const namespaceSuffix = remaining
                        .replace(/^\//, '')
                        .replace(/\/$/, '')
                        .replace(/\//g, '\\');

                    return namespaceSuffix
                        ? `${mapping.namespace}\\${namespaceSuffix}`
                        : mapping.namespace;
                }
            }
        }

        // Try PSR-0
        for (const mapping of autoload.psr0) {
            for (const basePath of mapping.paths) {
                const normalizedBasePath = '/' + basePath + '/';
                const idx = normalizedRelPath.indexOf(normalizedBasePath);

                if (idx !== -1) {
                    const remaining = normalizedRelPath.substring(idx + normalizedBasePath.length);
                    const namespaceSuffix = remaining
                        .replace(/^\//, '')
                        .replace(/\/$/, '')
                        .replace(/\//g, '\\');

                    // PSR-0: the namespace is part of the directory structure
                    return namespaceSuffix || mapping.namespace;
                }
            }
        }

        return null;
    }

    /**
     * Replace an existing namespace statement in the document.
     */
    private async replaceNamespaceStatement(
        editor: vscode.TextEditor,
        namespace: string,
        lineNumber: number
    ): Promise<void> {
        const realLine = lineNumber - 1;
        const text = editor.document.lineAt(realLine).text;
        const newText = text.replace(/namespace\s+.+/, namespace.trim());

        await editor.edit(textEdit => {
            textEdit.replace(
                new vscode.Range(realLine, 0, realLine, text.length),
                newText
            );
        });
    }
}
