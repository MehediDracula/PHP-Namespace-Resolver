import * as vscode from 'vscode';
import { UseStatement, DeclarationLines, DeclarationResult, InsertPosition } from '../types';
import { getInsertPosition as computeInsertPosition } from './insertPosition';

/**
 * Parses the structural elements of a PHP file:
 * PHP opening tag, namespace, use statements, and class/trait/interface/enum declarations.
 */
export class DeclarationParser {
    /**
     * Parse all declarations from the active document.
     * If `pickedClass` is provided, throws if it's already imported.
     */
    parse(document: vscode.TextDocument, pickedClass?: string): DeclarationResult {
        const useStatements: UseStatement[] = [];
        const declarationLines: DeclarationLines = {
            phpTag: 0,
            namespace: null,
            firstUseStatement: null,
            lastUseStatement: null,
            classDeclaration: null,
        };

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;

            // Check if already imported
            if (pickedClass !== null && pickedClass !== undefined) {
                if (text === `use ${pickedClass};`) {
                    throw new Error('The class is already imported.');
                }
            }

            // If all key declarations found, stop scanning
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
            } else if (/^\s*(namespace\s|<\?php\s+namespace\s)/.test(text)) {
                declarationLines.namespace = line + 1;
            } else if (/^\s*use\s+/.test(text) && !/^\s*use\s*\(/.test(text)) {
                // Match 'use Foo\Bar;' but not 'use ($var)' (closure use)
                const parsed = this.parseUseStatement(text, line);
                if (parsed) {
                    useStatements.push(parsed);
                    if (declarationLines.firstUseStatement === null) {
                        declarationLines.firstUseStatement = line + 1;
                    }
                    declarationLines.lastUseStatement = line + 1;
                }
            } else if (/^\s*(?:abstract\s+|final\s+)?(?:class|trait|interface|enum)\s+\w+/.test(text)) {
                declarationLines.classDeclaration = line + 1;
            }
        }

        return { useStatements, declarationLines };
    }

    /**
     * Determine where to insert a new use statement.
     */
    getInsertPosition(declarationLines: DeclarationLines): InsertPosition {
        return computeInsertPosition(declarationLines);
    }

    /**
     * Get array of imported class short names.
     */
    getImportedClassNames(document: vscode.TextDocument): string[] {
        const names: string[] = [];

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;

            if (/^\s*use\s+/.test(text) && !/^\s*use\s*\(/.test(text)) {
                const match = text.match(/use\s+(.+);/);
                if (match) {
                    const parts = match[1].split('\\');
                    const lastName = parts.pop();
                    if (lastName) {
                        // Handle aliases: use Foo\Bar as Baz;
                        const aliasMatch = lastName.match(/(\w+)\s+as\s+(\w+)/);
                        names.push(aliasMatch ? aliasMatch[2] : lastName.trim());
                    }
                }
            } else if (/^\s*(?:abstract\s+|final\s+)?(?:class|trait|interface|enum)\s+\w+/.test(text)) {
                break;
            }
        }

        return names;
    }

    /**
     * Parse a single use statement line into a UseStatement object.
     */
    private parseUseStatement(text: string, line: number): UseStatement | null {
        const match = text.match(/^\s*use\s+(.+);/);
        if (!match) { return null; }

        const raw = match[1].trim();
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

        return { text: text.trimStart(), line, fqcn, alias, className };
    }
}
