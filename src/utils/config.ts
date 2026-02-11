import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';

const SECTION = 'phpNamespaceResolver';

export function getConfig<K extends keyof ExtensionConfig>(key: K): ExtensionConfig[K] {
    return vscode.workspace.getConfiguration(SECTION).get<ExtensionConfig[K]>(
        key,
        getDefault(key)
    );
}

function getDefault<K extends keyof ExtensionConfig>(key: K): ExtensionConfig[K] {
    const defaults: ExtensionConfig = {
        exclude: '**/node_modules/**',
        autoSort: true,
        sortOnSave: false,
        sortMode: 'natural',
        leadingSeparator: true,
        removeOnSave: false,
        autoImportOnSave: false,
    };
    return defaults[key];
}
