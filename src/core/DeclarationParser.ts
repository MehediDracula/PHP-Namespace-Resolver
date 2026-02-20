import * as vscode from 'vscode';
import { UseStatement, DeclarationLines, DeclarationResult, InsertPosition } from '../types';
import { getInsertPosition as computeInsertPosition } from './insertPosition';

export class DeclarationParser {
    /** If `pickedClass` is provided, throws if it's already imported. */
    parse(document: vscode.TextDocument, pickedClass?: string): DeclarationResult {
        const useStatements: UseStatement[] = [];
        const declarationLines: DeclarationLines = {
            phpTag: 0,
            declare: null,
            namespace: null,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: null,
        };

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;

            if (pickedClass !== null && pickedClass !== undefined) {
                if (text === `use ${pickedClass};`) {
                    throw new Error('The class is already imported.');
                }
            }

            if (
                declarationLines.phpTag &&
                declarationLines.namespace !== null &&
                declarationLines.lastUseStatement !== null &&
                declarationLines.classDeclaration !== null
            ) {
                break;
            }

            if (text.startsWith('<?php')) {
                declarationLines.phpTag = line + 1;
            } else if (/^\s*declare\s*\(/.test(text)) {
                declarationLines.declare = line + 1;
            } else if (/^\s*(namespace\s|<\?php\s+namespace\s)/.test(text)) {
                declarationLines.namespace = line + 1;
            } else if (declarationLines.classDeclaration === null && /^\s*use\s+/.test(text) && !/^\s*use\s*\(/.test(text)) {
                // Match 'use Foo\Bar;', 'use function ...', 'use const ...' but not 'use ($var)' (closure use)
                const kindMatch = text.match(/^\s*use\s+(function|const)\s/);
                const kind: 'class' | 'function' | 'const' = kindMatch ? kindMatch[1] as 'function' | 'const' : 'class';

                let fullText = text;
                const startLine = line;

                // Handle multi-line grouped imports: use Foo\{ \n Bar, \n Baz \n };
                if (text.includes('{') && !text.includes('}')) {
                    for (let j = line + 1; j < document.lineCount; j++) {
                        fullText += ' ' + document.lineAt(j).text.trim();
                        if (document.lineAt(j).text.includes('}')) {
                            line = j;
                            break;
                        }
                    }
                }

                const parsed = this.parseUseStatement(fullText, startLine, kind);
                for (const stmt of parsed) {
                    if (pickedClass !== null && pickedClass !== undefined) {
                        if (stmt.fqcn === pickedClass) {
                            throw new Error('The class is already imported.');
                        }
                    }
                    useStatements.push(stmt);
                    if (declarationLines.firstUseStatement === null) {
                        declarationLines.firstUseStatement = startLine + 1;
                    }
                    declarationLines.lastUseStatement = line + 1;
                }
            } else if (/^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+\w+/.test(text)) {
                declarationLines.classDeclaration = line + 1;
            }
        }

        return { useStatements, declarationLines };
    }

    getInsertPosition(declarationLines: DeclarationLines): InsertPosition {
        return computeInsertPosition(declarationLines);
    }

    getImportedClassNames(document: vscode.TextDocument): string[] {
        const names: string[] = [];

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;

            if (/^\s*use\s+/.test(text) && !/^\s*use\s*\(/.test(text) && !/^\s*use\s+(?:function|const)\s/.test(text)) {
                let fullText = text;

                // Handle multi-line grouped imports
                if (text.includes('{') && !text.includes('}')) {
                    for (let j = line + 1; j < document.lineCount; j++) {
                        fullText += ' ' + document.lineAt(j).text.trim();
                        if (document.lineAt(j).text.includes('}')) {
                            line = j;
                            break;
                        }
                    }
                }

                const match = fullText.match(/use\s+(.+);/);
                if (match) {
                    const raw = match[1].trim();

                    // Check for grouped import: use Prefix\{Class1, Class2}
                    const groupMatch = raw.match(/^(.+)\\\{(.+)\}$/);
                    if (groupMatch) {
                        const entries = groupMatch[2].split(',').map(c => c.trim()).filter(c => c);
                        for (const entry of entries) {
                            const aliasMatch = entry.match(/^(.+)\s+as\s+(\w+)$/);
                            if (aliasMatch) {
                                names.push(aliasMatch[2]);
                            } else {
                                const entryParts = entry.split('\\');
                                names.push(entryParts[entryParts.length - 1]);
                            }
                        }
                    } else {
                        const parts = raw.split('\\');
                        const lastName = parts.pop();
                        if (lastName) {
                            // Handle aliases: use Foo\Bar as Baz;
                            const aliasMatch = lastName.match(/(\w+)\s+as\s+(\w+)/);
                            names.push(aliasMatch ? aliasMatch[2] : lastName.trim());
                        }
                    }
                }
            } else if (/^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+\w+/.test(text)) {
                break;
            }
        }

        return names;
    }

    getNamespace(document: vscode.TextDocument): string | null {
        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;
            const match = text.match(/^\s*(?:namespace|<\?php\s+namespace)\s+(.+?)\s*;/);
            if (match) {
                return match[1].trim();
            }
            if (/^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+\w+/.test(text)) {
                break;
            }
        }
        return null;
    }

    getDeclaredClassNames(document: vscode.TextDocument): string[] {
        const names: string[] = [];
        const regex = /^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+(\w+)/;
        for (let line = 0; line < document.lineCount; line++) {
            const match = document.lineAt(line).text.match(regex);
            if (match) {
                names.push(match[1]);
            }
        }
        return names;
    }

    private parseUseStatement(text: string, line: number, kind: 'class' | 'function' | 'const' = 'class'): UseStatement[] {
        const match = text.match(/^\s*use\s+(?:function\s+|const\s+)?(.+);/);
        if (!match) { return []; }

        const raw = match[1].trim();

        // Check for grouped import: use Prefix\{Class1, Class2, ...}
        const groupMatch = raw.match(/^(.+)\\\{(.+)\}$/);
        if (groupMatch) {
            const prefix = groupMatch[1].trim();
            const entries = groupMatch[2].split(',').map(c => c.trim()).filter(c => c);

            return entries.map(entry => {
                const aliasMatch = entry.match(/^(.+)\s+as\s+(\w+)$/);
                if (aliasMatch) {
                    const entryPath = aliasMatch[1].trim();
                    const alias = aliasMatch[2];
                    return {
                        text: text.trimStart(),
                        line,
                        fqcn: `${prefix}\\${entryPath}`,
                        alias,
                        className: alias,
                        kind,
                    };
                }
                const entryParts = entry.split('\\');
                return {
                    text: text.trimStart(),
                    line,
                    fqcn: `${prefix}\\${entry}`,
                    alias: null,
                    className: entryParts[entryParts.length - 1],
                    kind,
                };
            });
        }

        // Single import
        const aliasMatch = raw.match(/^(.+)\s+as\s+(\w+)$/);

        let fqcn: string;
        let alias: string | null;
        let className: string;

        if (aliasMatch) {
            fqcn = aliasMatch[1].trim();
            alias = aliasMatch[2];
            className = alias;
        } else {
            fqcn = raw;
            alias = null;
            const parts = fqcn.split('\\');
            className = parts[parts.length - 1];
        }

        return [{ text: text.trimStart(), line, fqcn, alias, className, kind }];
    }
}
