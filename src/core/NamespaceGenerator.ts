import * as vscode from 'vscode';
import { DeclarationParser } from './DeclarationParser';
import { parseAutoload, resolveNamespace } from './composerParser';
import { showStatusMessage } from '../utils/statusBar';

export class NamespaceGenerator {
    constructor(private parser: DeclarationParser) {}

    async generate(editor: vscode.TextEditor): Promise<void> {
        const currentUri = editor.document.uri;
        const currentFile = currentUri.fsPath;
        const normalizedCurrentFile = currentFile.replace(/\\/g, '/');
        const normalizedCurrentPath = normalizedCurrentFile.substring(0, normalizedCurrentFile.lastIndexOf('/'));

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentUri);
        if (!workspaceFolder) {
            return void showStatusMessage('No folder opened in workspace, cannot find composer.json');
        }

        const composerFile = await this.findComposerJson(normalizedCurrentFile, workspaceFolder);
        if (!composerFile) {
            return void showStatusMessage('No composer.json file found, automatic namespace generation failed');
        }

        const raw = await vscode.workspace.fs.readFile(composerFile);
        const composerJson = JSON.parse(Buffer.from(raw).toString('utf8'));
        const autoload = parseAutoload(composerJson);

        if (autoload.psr4.length === 0 && autoload.psr0.length === 0) {
            return void showStatusMessage('No psr-4 or psr-0 key in composer.json autoload, automatic namespace generation failed');
        }

        const composerDir = composerFile.fsPath.replace(/\\/g, '/').replace(/\/composer\.json$/, '');
        const relativePath = normalizedCurrentPath.substring(composerDir.length);

        const namespace = resolveNamespace(relativePath, autoload);
        if (!namespace) {
            return void showStatusMessage('Could not resolve namespace from composer.json autoload configuration');
        }

        const namespaceStatement = `namespace ${namespace};\n`;

        let declarationLines;
        try {
            ({ declarationLines } = this.parser.parse(editor.document));
        } catch (error: any) {
            return void showStatusMessage(error.message);
        }

        if (declarationLines.namespace !== null) {
            await this.replaceNamespaceStatement(editor, namespaceStatement, declarationLines.namespace);
        } else {
            const insertLine = declarationLines.declare ?? declarationLines.phpTag;
            await editor.edit(textEdit => {
                textEdit.insert(new vscode.Position(insertLine, 0), '\n' + namespaceStatement);
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
