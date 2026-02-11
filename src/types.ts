import * as vscode from 'vscode';

export interface UseStatement {
    text: string;
    line: number;
    fqcn: string;
    alias: string | null;
    className: string;
}

export interface DeclarationLines {
    phpTag: number;
    declare: number | null;
    namespace: number | null;
    firstUseStatement: number | null;
    lastUseStatement: number | null;
    classDeclaration: number | null;
}

export interface DeclarationResult {
    useStatements: UseStatement[];
    declarationLines: DeclarationLines;
}

export interface InsertPosition {
    line: number;
    prepend: string;
    append: string;
}

export interface DetectedClass {
    name: string;
    offset: number;
    line: number;
    character: number;
}

export interface ResolvedNamespace {
    fqcn: string;
    source: 'project' | 'builtin' | 'global';
}

export interface PsrMapping {
    namespace: string;
    paths: string[];
}

export interface ComposerAutoload {
    psr4: PsrMapping[];
    psr0: PsrMapping[];
}

export interface CacheEntry {
    fqcn: string;
    uri: vscode.Uri;
    className: string;
}

export type SortMode = 'length' | 'alphabetical' | 'natural';

export interface ExtensionConfig {
    exclude: string;
    autoSort: boolean;
    sortOnSave: boolean;
    sortMode: SortMode;
    leadingSeparator: boolean;
    removeOnSave: boolean;
    autoImportOnSave: boolean;
}

export enum DiagnosticCode {
    ClassNotImported = 'class-not-imported',
    ClassNotUsed = 'class-not-used',
}
