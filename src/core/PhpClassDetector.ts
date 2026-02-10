import { DetectedClass } from '../types';

/**
 * Detects PHP class references in source code.
 * Supports PHP 5.x through PHP 8.3 syntax patterns including:
 * - Class inheritance (extends)
 * - Interface implementation (implements)
 * - Function parameter type hints (including union & intersection types)
 * - Return type declarations
 * - Property type declarations (typed properties, promoted constructor params)
 * - new ClassName instantiation
 * - Static method calls (ClassName::)
 * - instanceof checks
 * - Catch block exception types (including multi-catch)
 * - PHP 8 Attributes (#[Attribute])
 * - Enum declarations with implements
 */
export class PhpClassDetector {
    private static readonly CLASS_NAME = '[A-Z][A-Za-z0-9_]*';

    /**
     * Get all unique PHP class names detected in the given text.
     */
    detectAll(text: string): string[] {
        const classes = new Set<string>();

        for (const name of this.getExtended(text)) { classes.add(name); }
        for (const name of this.getImplemented(text)) { classes.add(name); }
        for (const name of this.getFromFunctionParameters(text)) { classes.add(name); }
        for (const name of this.getReturnTypes(text)) { classes.add(name); }
        for (const name of this.getPropertyTypes(text)) { classes.add(name); }
        for (const name of this.getInitializedWithNew(text)) { classes.add(name); }
        for (const name of this.getFromStaticCalls(text)) { classes.add(name); }
        for (const name of this.getFromInstanceof(text)) { classes.add(name); }
        for (const name of this.getFromCatchBlocks(text)) { classes.add(name); }
        for (const name of this.getFromAttributes(text)) { classes.add(name); }
        for (const name of this.getEnumImplements(text)) { classes.add(name); }

        return Array.from(classes);
    }

    /**
     * Get all detected classes with their positions for diagnostics/highlighting.
     */
    detectAllWithPositions(text: string): DetectedClass[] {
        const results: DetectedClass[] = [];
        const seen = new Map<string, boolean>();
        const lines = text.split('\n');

        const classNames = this.detectAll(text);

        for (const name of classNames) {
            // Escape special regex characters in the class name
            const pattern = new RegExp(`(?<![a-zA-Z0-9_\\\\])${escapeRegex(name)}(?![a-zA-Z0-9_\\\\])`, 'g');
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(text)) !== null) {
                const offset = match.index;
                const pos = offsetToPosition(text, offset, lines);

                // Skip if on a namespace declaration line
                const lineText = lines[pos.line];
                if (/^\s*(namespace|use)\s/.test(lineText)) {
                    continue;
                }

                const key = `${name}:${pos.line}:${pos.character}`;
                if (!seen.has(key)) {
                    seen.set(key, true);
                    results.push({
                        name,
                        offset,
                        line: pos.line,
                        character: pos.character,
                    });
                }
            }
        }

        return results;
    }

    /** Classes after `extends` keyword */
    getExtended(text: string): string[] {
        return matchAll(text, new RegExp(`extends\\s+(${PhpClassDetector.CLASS_NAME})`, 'gm'));
    }

    /** Interfaces after `implements` keyword (comma-separated) */
    getImplemented(text: string): string[] {
        const regex = /implements\s+([A-Z][A-Za-z0-9_,\s\\]+?)(?:\s*\{|\s*$)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const interfaces = match[1].split(',');
            for (const iface of interfaces) {
                const trimmed = iface.trim().split('\\').pop();
                if (trimmed && /^[A-Z]/.test(trimmed)) {
                    results.push(trimmed);
                }
            }
        }
        return results;
    }

    /**
     * Type hints from function/method parameters.
     * Handles union types (A|B), intersection types (A&B), and nullable (?A).
     */
    getFromFunctionParameters(text: string): string[] {
        const regex = /function\s+\S+\s*\(([\s\S]*?)\)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const params = match[1];
            results.push(...this.extractTypesFromParameterList(params));
        }
        return results;
    }

    /** Return type declarations after ): */
    getReturnTypes(text: string): string[] {
        const regex = /\)\s*:\s*([\w\s|&?\\]+?)(?:\s*\{|\s*;|\s*$)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            results.push(...this.extractTypeNames(match[1]));
        }
        return results;
    }

    /**
     * Typed properties: visibility modifiers followed by type hints.
     * Also handles constructor promotion (public readonly Type $var).
     */
    getPropertyTypes(text: string): string[] {
        const regex = /(?:public|protected|private)\s+(?:readonly\s+|static\s+)?(?:readonly\s+)?([\w|&?\\]+)\s+\$/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            results.push(...this.extractTypeNames(match[1]));
        }
        return results;
    }

    /** new ClassName(...) */
    getInitializedWithNew(text: string): string[] {
        return matchAll(text, new RegExp(`new\\s+(${PhpClassDetector.CLASS_NAME})`, 'gm'));
    }

    /** ClassName::method() or ClassName::CONSTANT */
    getFromStaticCalls(text: string): string[] {
        return matchAll(text, new RegExp(`(${PhpClassDetector.CLASS_NAME})::`, 'gm'));
    }

    /** instanceof ClassName */
    getFromInstanceof(text: string): string[] {
        return matchAll(text, new RegExp(`instanceof\\s+(${PhpClassDetector.CLASS_NAME})`, 'gm'));
    }

    /** catch (ExceptionType | AnotherException $e) */
    getFromCatchBlocks(text: string): string[] {
        const regex = /catch\s*\(\s*([\w\s|\\]+)\s+\$/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const types = match[1].split('|');
            for (const type of types) {
                const trimmed = type.trim().split('\\').pop();
                if (trimmed && /^[A-Z]/.test(trimmed)) {
                    results.push(trimmed);
                }
            }
        }
        return results;
    }

    /** PHP 8 Attributes: #[AttributeName(...)] */
    getFromAttributes(text: string): string[] {
        const regex = /#\[\s*([\w\\]+)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const name = match[1].split('\\').pop();
            if (name && /^[A-Z]/.test(name)) {
                results.push(name);
            }
        }
        return results;
    }

    /** enum Foo: string implements Bar, Baz */
    getEnumImplements(text: string): string[] {
        const regex = /enum\s+\w+(?:\s*:\s*\w+)?\s+implements\s+([A-Z][A-Za-z0-9_,\s\\]+?)(?:\s*\{)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const interfaces = match[1].split(',');
            for (const iface of interfaces) {
                const trimmed = iface.trim().split('\\').pop();
                if (trimmed && /^[A-Z]/.test(trimmed)) {
                    results.push(trimmed);
                }
            }
        }
        return results;
    }

    /**
     * Extract class names from a type expression that may contain
     * union types (|), intersection types (&), nullable (?), and scalar types.
     */
    private extractTypeNames(typeExpr: string): string[] {
        const results: string[] = [];
        // Split on | and & to handle union and intersection types
        const types = typeExpr.split(/[|&]/);

        for (const type of types) {
            let trimmed = type.trim();
            // Remove nullable prefix
            trimmed = trimmed.replace(/^\?/, '');
            // Get the short class name (last part after \)
            const shortName = trimmed.split('\\').pop()?.trim();
            if (shortName && /^[A-Z]/.test(shortName) && !isScalarType(shortName)) {
                results.push(shortName);
            }
        }
        return results;
    }

    /**
     * Extract type hints from a function parameter list string.
     */
    private extractTypesFromParameterList(params: string): string[] {
        const results: string[] = [];
        const parts = params.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) { continue; }

            // Match everything before the $ sign as potential type hint
            const typeMatch = trimmed.match(/^([\w\s|&?\\]+?)\s*\$/);
            if (typeMatch) {
                results.push(...this.extractTypeNames(typeMatch[1]));
            }
        }
        return results;
    }
}

/** Simple extraction of capture group 1 from all regex matches */
function matchAll(text: string, regex: RegExp): string[] {
    const results: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        results.push(match[1]);
    }
    return results;
}

/** Check if a type name is a PHP scalar/special type that doesn't need importing */
function isScalarType(name: string): boolean {
    const scalars = new Set([
        'String', 'Int', 'Float', 'Bool', 'Array', 'Object',
        'Null', 'Void', 'Never', 'Mixed', 'Self', 'Static', 'Parent',
        'True', 'False', 'Iterable', 'Callable',
    ]);
    return scalars.has(name);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function offsetToPosition(text: string, offset: number, lines: string[]): { line: number; character: number } {
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
        // +1 for the newline character
        const lineLength = lines[i].length + 1;
        if (charCount + lineLength > offset) {
            return { line: i, character: offset - charCount };
        }
        charCount += lineLength;
    }
    return { line: lines.length - 1, character: 0 };
}
