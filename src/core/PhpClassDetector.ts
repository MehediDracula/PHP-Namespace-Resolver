import { DetectedClass } from '../types';

export class PhpClassDetector {
    private static readonly CLASS_NAME = '[A-Z][A-Za-z0-9_]*';

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
        for (const name of this.getFromTraitUse(text)) { classes.add(name); }
        for (const name of this.getEnumImplements(text)) { classes.add(name); }

        return Array.from(classes);
    }

    detectAllWithPositions(text: string): DetectedClass[] {
        const results: DetectedClass[] = [];
        const seen = new Map<string, boolean>();
        const lines = text.split('\n');

        const classNames = this.detectAll(text);

        for (const name of classNames) {
            const pattern = new RegExp(`(?<![a-zA-Z0-9_\\\\])${escapeRegex(name)}(?![a-zA-Z0-9_\\\\])`, 'g');
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(text)) !== null) {
                const offset = match.index;
                const pos = offsetToPosition(text, offset, lines);

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

    getExtended(text: string): string[] {
        return matchAll(text, new RegExp(`extends\\s+(${PhpClassDetector.CLASS_NAME})`, 'gm'));
    }

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

    getReturnTypes(text: string): string[] {
        const regex = /\)\s*:\s*([\w\s|&?\\]+?)(?:\s*\{|\s*;|\s*$)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            results.push(...this.extractTypeNames(match[1]));
        }
        return results;
    }

    getPropertyTypes(text: string): string[] {
        const regex = /(?:public|protected|private)\s+(?:readonly\s+|static\s+)?(?:readonly\s+)?([\w|&?\\]+)\s+\$/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            results.push(...this.extractTypeNames(match[1]));
        }
        return results;
    }

    getInitializedWithNew(text: string): string[] {
        return matchAll(text, new RegExp(`new\\s+(${PhpClassDetector.CLASS_NAME})`, 'gm'));
    }

    getFromStaticCalls(text: string): string[] {
        return matchAll(text, new RegExp(`(${PhpClassDetector.CLASS_NAME})::`, 'gm'));
    }

    getFromInstanceof(text: string): string[] {
        return matchAll(text, new RegExp(`instanceof\\s+(${PhpClassDetector.CLASS_NAME})`, 'gm'));
    }

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

    getFromTraitUse(text: string): string[] {
        const regex = /^\s+use\s+([A-Z][\w\s,]+)\s*[;{]/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const traits = match[1].split(',');
            for (const trait of traits) {
                const trimmed = trait.trim();
                if (trimmed && /^[A-Z]/.test(trimmed)) {
                    results.push(trimmed);
                }
            }
        }
        return results;
    }

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

    private extractTypeNames(typeExpr: string): string[] {
        const results: string[] = [];
        const types = typeExpr.split(/[|&]/);

        for (const type of types) {
            let trimmed = type.trim();
            trimmed = trimmed.replace(/^\?/, '');
            const shortName = trimmed.split('\\').pop()?.trim();
            if (shortName && /^[A-Z]/.test(shortName) && !isScalarType(shortName)) {
                results.push(shortName);
            }
        }
        return results;
    }

    private extractTypesFromParameterList(params: string): string[] {
        const results: string[] = [];
        const parts = params.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) { continue; }

            const typeMatch = trimmed.match(/^([\w\s|&?\\]+?)\s*\$/);
            if (typeMatch) {
                results.push(...this.extractTypeNames(typeMatch[1]));
            }
        }
        return results;
    }
}

function matchAll(text: string, regex: RegExp): string[] {
    const results: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        results.push(match[1]);
    }
    return results;
}

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
