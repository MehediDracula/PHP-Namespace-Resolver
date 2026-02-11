import * as vscode from 'vscode';
import { DeclarationParser } from './DeclarationParser';
import { parseAutoload, resolveNamespace } from './composerParser';

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
        const autoload = parseAutoload(composerJson);

        if (autoload.psr4.length === 0 && autoload.psr0.length === 0) {
            return void vscode.window.setStatusBarMessage('No psr-4 or psr-0 key in composer.json autoload, automatic namespace generation failed', 3000);
        }

        const composerDir = composerFile.fsPath.replace(/\\/g, '/').replace(/\/composer\.json$/, '');
        const relativePath = normalizedCurrentPath.substring(composerDir.length);

        const namespace = resolveNamespace(relativePath, autoload);
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
