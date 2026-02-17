import * as vscode from 'vscode';
import { CacheEntry, PersistedIndex } from '../types';
import { getConfig } from '../utils/config';
import { showStatusMessage } from '../utils/statusBar';

export class NamespaceCache implements vscode.Disposable {
    private static readonly INDEX_VERSION = 1;
    private static readonly INDEX_FILE_NAME = 'namespace-index.json';

    private cache = new Map<string, CacheEntry[]>();
    private fileIndex = new Map<string, { mtime: number; entries: { fqcn: string; className: string }[] }>();
    private watcher: vscode.FileSystemWatcher | undefined;
    private initialized = false;
    private _indexed = true;
    private persistTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingChanges = new Map<string, ReturnType<typeof setTimeout>>();

    private readonly _onDidFinishIndexing = new vscode.EventEmitter<void>();
    readonly onDidFinishIndexing = this._onDidFinishIndexing.event;

    constructor(private readonly storageUri?: vscode.Uri) {}

    get indexed(): boolean {
        return this._indexed;
    }

    async initialize(): Promise<void> {
        if (this.initialized) { return; }
        this.initialized = true;

        const loaded = await this.loadPersistedIndex();

        if (loaded) {
            this._onDidFinishIndexing.fire();
            await this.incrementalUpdate();
            await this.persistIndex();
        } else {
            await this.buildIndex();
            await this.persistIndex();
        }

        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.php');
        this.watcher.onDidCreate(uri => this.onFileChange(uri));
        this.watcher.onDidChange(uri => this.onFileChange(uri));
        this.watcher.onDidDelete(uri => this.onFileDelete(uri));
    }

    lookup(className: string): CacheEntry[] {
        return this.cache.get(className) ?? [];
    }

    async rebuild(): Promise<void> {
        this.cache.clear();
        this.fileIndex.clear();
        await this.buildIndex();
        await this.persistIndex();
    }

    has(className: string): boolean {
        return this.cache.has(className) && this.cache.get(className)!.length > 0;
    }

    dispose(): void {
        clearTimeout(this.persistTimer);
        for (const timer of this.pendingChanges.values()) { clearTimeout(timer); }
        this.pendingChanges.clear();
        this.watcher?.dispose();
        this._onDidFinishIndexing.dispose();
        this.cache.clear();
        this.fileIndex.clear();
    }

    private async buildIndex(): Promise<void> {
        if (!this._indexed) { return; }
        this._indexed = false;

        showStatusMessage('$(sync~spin) PHP Namespace Resolver: Indexing...', 60000);

        try {
            const exclude = getConfig('exclude');
            const files = await vscode.workspace.findFiles('**/*.php', exclude);

            const BATCH_SIZE = 64;
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(uri => this.indexFile(uri)));
            }
        } finally {
            showStatusMessage('$(check) PHP Namespace Resolver: Indexing complete.', 3000);
            this._indexed = true;
            this._onDidFinishIndexing.fire();
        }
    }

    private async loadPersistedIndex(): Promise<boolean> {
        if (!this.storageUri) { return false; }

        try {
            const indexUri = vscode.Uri.joinPath(this.storageUri, NamespaceCache.INDEX_FILE_NAME);
            const raw = await vscode.workspace.fs.readFile(indexUri);
            const json: PersistedIndex = JSON.parse(Buffer.from(raw).toString('utf8'));

            if (json.version !== NamespaceCache.INDEX_VERSION) { return false; }

            for (const [uriString, fileData] of Object.entries(json.files)) {
                const uri = vscode.Uri.parse(uriString);
                this.fileIndex.set(uriString, { mtime: fileData.mtime, entries: fileData.entries });

                for (const entry of fileData.entries) {
                    const cacheEntry: CacheEntry = { fqcn: entry.fqcn, uri, className: entry.className };
                    if (!this.cache.has(entry.className)) {
                        this.cache.set(entry.className, []);
                    }
                    this.cache.get(entry.className)!.push(cacheEntry);
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    private async incrementalUpdate(): Promise<void> {
        showStatusMessage('$(sync~spin) PHP Namespace Resolver: Updating index...', 60000);

        try {
            const exclude = getConfig('exclude');
            const files = await vscode.workspace.findFiles('**/*.php', exclude);

            const STAT_BATCH = 256;
            const toIndex: vscode.Uri[] = [];
            const seenUris = new Set<string>();

            for (let i = 0; i < files.length; i += STAT_BATCH) {
                const batch = files.slice(i, i + STAT_BATCH);
                const results = await Promise.all(batch.map(async (uri) => {
                    const uriString = uri.toString();
                    seenUris.add(uriString);
                    const existing = this.fileIndex.get(uriString);

                    if (!existing) { return uri; }

                    try {
                        const stat = await vscode.workspace.fs.stat(uri);
                        if (stat.mtime !== existing.mtime) { return uri; }
                    } catch {
                        this.removeFile(uri);
                    }
                    return null;
                }));
                for (const uri of results) {
                    if (uri) { toIndex.push(uri); }
                }
            }

            for (const uriString of this.fileIndex.keys()) {
                if (!seenUris.has(uriString)) {
                    this.removeFile(vscode.Uri.parse(uriString));
                }
            }

            const INDEX_BATCH = 64;
            for (let i = 0; i < toIndex.length; i += INDEX_BATCH) {
                const batch = toIndex.slice(i, i + INDEX_BATCH);
                await Promise.all(batch.map(uri => this.indexFile(uri)));
            }

            const changed = toIndex.length > 0;

            if (changed) {
                this._onDidFinishIndexing.fire();
            }
        } finally {
            showStatusMessage('$(check) PHP Namespace Resolver: Index up to date.', 3000);
        }
    }

    private async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const [raw, stat] = await Promise.all([
                vscode.workspace.fs.readFile(uri),
                vscode.workspace.fs.stat(uri),
            ]);
            const text = Buffer.from(raw).toString('utf8');

            this.removeFile(uri);

            const uriString = uri.toString();
            const nsMatch = text.match(/^(?:namespace|<\?php\s+namespace)\s+(.+?);/m);
            if (!nsMatch) {
                // Record in fileIndex with empty entries to avoid re-reading next startup
                this.fileIndex.set(uriString, { mtime: stat.mtime, entries: [] });
                return;
            }

            const namespace = nsMatch[1].trim();
            const entries: { fqcn: string; className: string }[] = [];

            const declRegex = /^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+(\w+)/gm;
            let match: RegExpExecArray | null;

            while ((match = declRegex.exec(text)) !== null) {
                const className = match[1];
                const fqcn = `${namespace}\\${className}`;

                const cacheEntry: CacheEntry = { fqcn, uri, className };

                if (!this.cache.has(className)) {
                    this.cache.set(className, []);
                }
                this.cache.get(className)!.push(cacheEntry);
                entries.push({ fqcn, className });
            }

            this.fileIndex.set(uriString, { mtime: stat.mtime, entries });
        } catch {}
    }

    private removeFile(uri: vscode.Uri): void {
        const uriStr = uri.toString();
        const existing = this.fileIndex.get(uriStr);
        this.fileIndex.delete(uriStr);

        if (!existing || existing.entries.length === 0) { return; }

        for (const entry of existing.entries) {
            const cached = this.cache.get(entry.className);
            if (!cached) { continue; }
            const filtered = cached.filter(e => e.uri.toString() !== uriStr);
            if (filtered.length === 0) {
                this.cache.delete(entry.className);
            } else {
                this.cache.set(entry.className, filtered);
            }
        }
    }

    private async persistIndex(): Promise<void> {
        if (!this.storageUri) { return; }

        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);

            const data: PersistedIndex = {
                version: NamespaceCache.INDEX_VERSION,
                files: {},
            };

            for (const [uriString, fileData] of this.fileIndex) {
                data.files[uriString] = { mtime: fileData.mtime, entries: fileData.entries };
            }

            const indexUri = vscode.Uri.joinPath(this.storageUri, NamespaceCache.INDEX_FILE_NAME);
            const content = Buffer.from(JSON.stringify(data), 'utf8');
            await vscode.workspace.fs.writeFile(indexUri, content);
        } catch {}
    }

    private onFileChange(uri: vscode.Uri): void {
        const key = uri.toString();
        // Debounce per-file so rapid saves don't re-index the same file repeatedly
        if (this.pendingChanges.has(key)) {
            clearTimeout(this.pendingChanges.get(key));
        }
        this.pendingChanges.set(key, setTimeout(async () => {
            this.pendingChanges.delete(key);
            await this.indexFile(uri);
            this.debouncedPersist();
        }, 1000));
    }

    private async onFileDelete(uri: vscode.Uri): Promise<void> {
        this.removeFile(uri);
        this.debouncedPersist();
    }

    private debouncedPersist(): void {
        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => this.persistIndex(), 2000);
    }
}
