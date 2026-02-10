import * as vscode from 'vscode';

/** Represents a use statement found in a PHP file */
export interface UseStatement {
    text: string;
    line: number;
    fqcn: string;
    alias: string | null;
    className: string;
}

/** Represents the key structural lines found in a PHP file */
export interface DeclarationLines {
    phpTag: number;
    namespace: number | null;
    firstUseStatement: number | null;
    lastUseStatement: number | null;
    classDeclaration: number | null;
}

/** Result of parsing declarations from a PHP file */
export interface DeclarationResult {
    useStatements: UseStatement[];
    declarationLines: DeclarationLines;
}

/** Where and how to insert a new use statement */
export interface InsertPosition {
    line: number;
    prepend: string;
    append: string;
}

/** A PHP class reference detected in source code */
export interface DetectedClass {
    name: string;
    offset: number;
    line: number;
    character: number;
}

/** A resolved namespace for a class */
export interface ResolvedNamespace {
    fqcn: string;
    source: 'project' | 'builtin' | 'global';
}

/** PSR autoload mapping entry */
export interface PsrMapping {
    namespace: string;
    paths: string[];
}

/** Composer autoload configuration */
export interface ComposerAutoload {
    psr4: PsrMapping[];
    psr0: PsrMapping[];
}

/** Namespace cache entry */
export interface CacheEntry {
    fqcn: string;
    uri: vscode.Uri;
    className: string;
}

/** Sort mode for imports */
export type SortMode = 'length' | 'alphabetical' | 'natural';

/** Extension configuration with typed keys */
export interface ExtensionConfig {
    exclude: string;
    showMessageOnStatusBar: boolean;
    autoSort: boolean;
    sortOnSave: boolean;
    sortAlphabetically: boolean;
    sortNatural: boolean;
    leadingSeparator: boolean;
    highlightOnSave: boolean;
    highlightOnOpen: boolean;
    highlightNotImportedColor: string;
    highlightNotUsedColor: string;
    removeOnSave: boolean;
    autoImportOnSave: boolean;
}

/** Diagnostic code identifiers */
export enum DiagnosticCode {
    ClassNotImported = 'class-not-imported',
    ClassNotUsed = 'class-not-used',
}
