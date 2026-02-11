import * as vscode from 'vscode';
import { CacheEntry } from '../types';
import { getConfig } from '../utils/config';

export class NamespaceCache implements vscode.Disposable {
    private cache = new Map<string, CacheEntry[]>();
    private watcher: vscode.FileSystemWatcher | undefined;
    private initialized = false;
    private building = false;

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
        this.cache.clear();
    }

    private async buildIndex(): Promise<void> {
        if (this.building) { return; }
        this.building = true;

        try {
            const exclude = getConfig('exclude');
            const files = await vscode.workspace.findFiles('**/*.php', exclude);

            for (const uri of files) {
                await this.indexFile(uri);
            }
        } finally {
            this.building = false;
        }
    }

    private async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();

            this.removeFile(uri);

            const nsMatch = text.match(/^(?:namespace|<\?php\s+namespace)\s+(.+?);/m);
            if (!nsMatch) { return; }

            const namespace = nsMatch[1].trim();

            const declRegex = /^\s*(?:abstract\s+|final\s+)?(?:class|trait|interface|enum)\s+(\w+)/gm;
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
