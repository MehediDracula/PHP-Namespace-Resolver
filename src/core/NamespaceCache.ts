import * as vscode from 'vscode';
import { CacheEntry } from '../types';
import { getConfig } from '../utils/config';
import { showStatusMessage } from '../utils/statusBar';

export class NamespaceCache implements vscode.Disposable {
    private cache = new Map<string, CacheEntry[]>();
    private watcher: vscode.FileSystemWatcher | undefined;
    private initialized = false;
    private _indexed = true;

    private readonly _onDidFinishIndexing = new vscode.EventEmitter<void>();
    readonly onDidFinishIndexing = this._onDidFinishIndexing.event;

    get indexed(): boolean {
        return this._indexed;
    }

    async initialize(): Promise<void> {
        if (this.initialized) { return; }
        this.initialized = true;

        await this.buildIndex();

        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.php');
        this.watcher.onDidCreate(uri => this.indexFile(uri));
        this.watcher.onDidChange(uri => this.indexFile(uri));
        this.watcher.onDidDelete(uri => this.removeFile(uri));
    }

    lookup(className: string): CacheEntry[] {
        return this.cache.get(className) ?? [];
    }

    async rebuild(): Promise<void> {
        this.cache.clear();
        await this.buildIndex();
    }

    has(className: string): boolean {
        return this.cache.has(className) && this.cache.get(className)!.length > 0;
    }

    dispose(): void {
        this.watcher?.dispose();
        this._onDidFinishIndexing.dispose();
        this.cache.clear();
    }

    private async buildIndex(): Promise<void> {
        if (!this._indexed) { return; }
        this._indexed = false;

        showStatusMessage('$(sync~spin) PHP Namespace Resolver: Indexing...', 60000);

        try {
            const exclude = getConfig('exclude');
            const files = await vscode.workspace.findFiles('**/*.php', exclude);

            for (const uri of files) {
                await this.indexFile(uri);
            }
        } finally {
            showStatusMessage('$(check) PHP Namespace Resolver: Indexing complete.', 3000);
            this._indexed = true;
            this._onDidFinishIndexing.fire();
        }
    }

    private async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const raw = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(raw).toString('utf8');

            this.removeFile(uri);

            const nsMatch = text.match(/^(?:namespace|<\?php\s+namespace)\s+(.+?);/m);
            if (!nsMatch) { return; }

            const namespace = nsMatch[1].trim();

            const declRegex = /^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+(\w+)/gm;
            let match: RegExpExecArray | null;

            while ((match = declRegex.exec(text)) !== null) {
                const className = match[1];
                const fqcn = `${namespace}\\${className}`;

                const entry: CacheEntry = { fqcn, uri, className };

                if (!this.cache.has(className)) {
                    this.cache.set(className, []);
                }
                this.cache.get(className)!.push(entry);
            }
        } catch {}
    }

    private removeFile(uri: vscode.Uri): void {
        const uriStr = uri.toString();
        for (const [className, entries] of this.cache) {
            const filtered = entries.filter(e => e.uri.toString() !== uriStr);
            if (filtered.length === 0) {
                this.cache.delete(className);
            } else {
                this.cache.set(className, filtered);
            }
        }
    }
}
