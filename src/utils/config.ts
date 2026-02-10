import * as vscode from 'vscode';
import { ExtensionConfig, SortMode } from '../types';

const SECTION = 'namespaceResolver';

export function getConfig<K extends keyof ExtensionConfig>(key: K): ExtensionConfig[K] {
    return vscode.workspace.getConfiguration(SECTION).get<ExtensionConfig[K]>(
        key,
        getDefault(key)
    );
}

export function getSortMode(): SortMode {
    if (getConfig('sortNatural')) {
        return 'natural';
    }
    if (getConfig('sortAlphabetically')) {
        return 'alphabetical';
    }
    return 'length';
}

function getDefault<K extends keyof ExtensionConfig>(key: K): ExtensionConfig[K] {
    const defaults: ExtensionConfig = {
        exclude: '**/node_modules/**',
        showMessageOnStatusBar: false,
        autoSort: true,
        sortOnSave: false,
        sortAlphabetically: false,
        sortNatural: false,
        leadingSeparator: true,
        highlightOnSave: false,
        highlightOnOpen: false,
        highlightNotImportedColor: 'rgba(255, 155, 0, 0.5)',
        highlightNotUsedColor: 'rgba(255, 55, 55, 0.5)',
        removeOnSave: false,
        autoImportOnSave: false,
    };
    return defaults[key];
}
