import { DetectedClass } from '../types';

// Pre-compiled regex patterns — compiled once at module load to avoid re-creating complex patterns on every keystroke
const STRINGS_HEREDOC_COMMENTS =
    `'(?:[^'\\\\]|\\\\.)*'` +          // Single-quoted strings
    `|"(?:[^"\\\\]|\\\\.)*"` +         // Double-quoted strings
    `|<<<[ \\t]*'?(\\w+)'?\\r?\\n[\\s\\S]*?\\r?\\n[ \\t]*\\1;?` + // Heredoc/Nowdoc
    `|//[^\\n]*` +                      // // comments
    `|#(?!\\[)[^\\n]*`;                 // # comments (not #[ attributes)

const SANITIZE_ALL_RE = new RegExp(
    STRINGS_HEREDOC_COMMENTS + `|/\\*[\\s\\S]*?\\*/`, 'g'       // All block comments
);
const SANITIZE_DIAG_RE = new RegExp(
    STRINGS_HEREDOC_COMMENTS + `|/\\*(?!\\*)[\\s\\S]*?\\*/`, 'g' // Non-PHPDoc only
);
const BLANK_NON_NEWLINE = /[^\r\n]/g;

function blankMatch(match: string): string {
    return match.replace(BLANK_NON_NEWLINE, ' ');
}

/**
 * Blanks out string contents and all comments, preserving character positions
 * (newlines kept, other chars replaced with spaces). PHPDoc type extraction
 * is handled separately by getFromPhpDoc() which receives the original text.
 */
export function sanitizePhpCode(text: string): string {
    return text.replace(SANITIZE_ALL_RE, blankMatch);
}

/**
 * Like sanitizePhpCode but preserves PHPDoc block content, only blanking
 * strings, non-PHPDoc comments, and PHPDoc free-text description lines.
 * Used by DiagnosticManager for position scanning where PHPDoc @tag types
 * still need to be matched.
 */
export function sanitizeForDiagnostics(text: string): string {
    return text.replace(SANITIZE_DIAG_RE, blankMatch);
}

export class PhpClassDetector {
    private static readonly CLASS_NAME = '[A-Z][A-Za-z0-9_]*';

    detectAll(text: string): string[] {
        const sanitized = sanitizePhpCode(text);
        return this.detectAllFromSanitized(text, sanitized);
    }

    detectAllWithPositions(text: string): DetectedClass[] {
        const results: DetectedClass[] = [];
        const seen = new Map<string, boolean>();
        const sanitized = sanitizePhpCode(text);
        const lines = text.split('\n');

        const classNames = this.detectAllFromSanitized(text, sanitized);

        for (const name of classNames) {
            const pattern = new RegExp(`(?<![a-zA-Z0-9_\\\\])${escapeRegex(name)}(?![a-zA-Z0-9_\\\\])`, 'g');
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(sanitized)) !== null) {
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

    private detectAllFromSanitized(originalText: string, sanitized: string): string[] {
        const classes = new Set<string>();

        for (const name of this.getExtended(sanitized)) { classes.add(name); }
        for (const name of this.getImplemented(sanitized)) { classes.add(name); }
        for (const name of this.getFromFunctionParameters(sanitized)) { classes.add(name); }
        for (const name of this.getReturnTypes(sanitized)) { classes.add(name); }
        for (const name of this.getPropertyTypes(sanitized)) { classes.add(name); }
        for (const name of this.getInitializedWithNew(sanitized)) { classes.add(name); }
        for (const name of this.getFromStaticCalls(sanitized)) { classes.add(name); }
        for (const name of this.getFromInstanceof(sanitized)) { classes.add(name); }
        for (const name of this.getFromCatchBlocks(sanitized)) { classes.add(name); }
        for (const name of this.getFromAttributes(sanitized)) { classes.add(name); }
        for (const name of this.getFromTraitUse(sanitized)) { classes.add(name); }
        for (const name of this.getEnumImplements(sanitized)) { classes.add(name); }
        for (const name of this.getFromPhpDoc(originalText)) { classes.add(name); }
        for (const name of this.getFromTypedConstants(sanitized)) { classes.add(name); }

        // Filter out names that only appear as part of fully qualified names (preceded by \)
        return Array.from(classes).filter(name => {
            const pattern = new RegExp(`(?<![a-zA-Z0-9_\\\\])${escapeRegex(name)}(?![a-zA-Z0-9_\\\\])`, 'g');
            let match;
            while ((match = pattern.exec(originalText)) !== null) {
                if (match.index === 0 || originalText[match.index - 1] !== '\\') {
                    return true;
                }
            }
            return false;
        });
    }

    getExtended(text: string): string[] {
        const regex = /extends\s+([A-Z][A-Za-z0-9_,\s\\]+?)(?:\s*\{|\s*implements\s|\s*$)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const parents = match[1].split(',');
            for (const parent of parents) {
                const trimmed = parent.trim().split('\\').pop();
                if (trimmed && /^[A-Z]/.test(trimmed)) {
                    results.push(trimmed);
                }
            }
        }
        return results;
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
        const regex = /(?:function\s+\w+|function|fn|set)\s*\(((?:[^()]*|\([^()]*\))*)\)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const params = match[1];
            results.push(...this.extractTypesFromParameterList(params));
        }
        return results;
    }

    getReturnTypes(text: string): string[] {
        const regex = /\)\s*:\s*([\w\s|&?\\()]+?)(?:\s*\{|\s*;|\s*=>|\s*$)/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            results.push(...this.extractTypeNames(match[1]));
        }
        return results;
    }

    getPropertyTypes(text: string): string[] {
        const regex = /(?:public|protected|private)\s+(?:(?:public|protected|private)\(set\)\s+)?(?:readonly\s+|static\s+)?(?:readonly\s+)?([\w|&?\\()]+)\s+\$/gm;
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
        const regex = /catch\s*\(\s*([\w\s|\\]+?)(?:\s+\$\w+)?\s*\)/gm;
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
        const blockRegex = /#\[([^\]]+)\]/gm;
        const results: string[] = [];
        let blockMatch: RegExpExecArray | null;

        while ((blockMatch = blockRegex.exec(text)) !== null) {
            const content = blockMatch[1];
            // Match each attribute name (handling nested parens for args)
            const attrRegex = /(?:^|,)\s*([\w\\]+)/g;
            let match: RegExpExecArray | null;
            while ((match = attrRegex.exec(content)) !== null) {
                const name = match[1].split('\\').pop();
                if (name && /^[A-Z]/.test(name)) {
                    results.push(name);
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

    getFromPhpDoc(text: string): string[] {
        const results: string[] = [];
        const docBlockRegex = /\/\*\*[\s\S]*?\*\//g;
        let blockMatch: RegExpExecArray | null;

        while ((blockMatch = docBlockRegex.exec(text)) !== null) {
            const block = blockMatch[0];

            // @param Type $var, @var Type [$var], @property[-read|-write] Type $name
            const paramRegex = /@(?:param|var|property(?:-read|-write)?)\s+(.+?)\s+\$/gm;
            let match: RegExpExecArray | null;
            while ((match = paramRegex.exec(block)) !== null) {
                results.push(...this.extractClassNamesFromDocType(match[1]));
            }

            // @return Type, @throws Type, @psalm-return Type, @phpstan-return Type
            const returnRegex = /@(?:return|throws|psalm-return|phpstan-return|psalm-param|phpstan-param|psalm-var|phpstan-var)\s+(\S+)/gm;
            while ((match = returnRegex.exec(block)) !== null) {
                results.push(...this.extractClassNamesFromDocType(match[1]));
            }

            // @mixin Type, @see Type
            const simpleRefRegex = /@(?:mixin|see)\s+(\S+)/gm;
            while ((match = simpleRefRegex.exec(block)) !== null) {
                results.push(...this.extractClassNamesFromDocType(match[1]));
            }

            // @extends Type<...>, @implements Type<...>
            const extendsRegex = /@(?:extends|implements|template-extends|template-implements)\s+(\S+)/gm;
            while ((match = extendsRegex.exec(block)) !== null) {
                results.push(...this.extractClassNamesFromDocType(match[1]));
            }

            // @template T of Type
            const templateRegex = /@template\s+\w+\s+of\s+(\S+)/gm;
            while ((match = templateRegex.exec(block)) !== null) {
                results.push(...this.extractClassNamesFromDocType(match[1]));
            }

            // @method [static] ReturnType methodName(ParamType $param)
            const methodRegex = /@method\s+(?:static\s+)?(\S+)\s+\w+\s*\(([^)]*)\)/gm;
            while ((match = methodRegex.exec(block)) !== null) {
                results.push(...this.extractClassNamesFromDocType(match[1]));
                if (match[2]) {
                    const params = match[2].split(',');
                    for (const param of params) {
                        const typeMatch = param.trim().match(/^(\S+)/);
                        if (typeMatch) {
                            results.push(...this.extractClassNamesFromDocType(typeMatch[1]));
                        }
                    }
                }
            }
        }

        return results;
    }

    getFromTypedConstants(text: string): string[] {
        const regex = /(?:(?:public|protected|private)\s+)?const\s+([\w|&?\\()]+)\s+[A-Z_]/gm;
        const results: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            results.push(...this.extractTypeNames(match[1]));
        }
        return results;
    }

    getFromTraitUse(text: string): string[] {
        const results: string[] = [];
        const lines = text.split('\n');
        let pastClassDeclaration = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!pastClassDeclaration) {
                if (/^\s*(?:abstract\s+|final\s+|readonly\s+)*(?:class|trait|interface|enum)\s+\w+/.test(line)) {
                    pastClassDeclaration = true;
                }
                continue;
            }

            if (/^\s*use\s+/.test(line) && !/^\s*use\s*\(/.test(line)) {
                // Handle multi-line trait use statements
                let fullLine = line;
                if (!line.match(/[;{]/)) {
                    for (let j = i + 1; j < lines.length; j++) {
                        fullLine += ' ' + lines[j].trim();
                        if (lines[j].match(/[;{]/)) {
                            i = j;
                            break;
                        }
                    }
                }

                const match = fullLine.match(/^\s*use\s+(.+?)\s*[;{]/);
                if (match) {
                    const traits = match[1].split(',');
                    for (const trait of traits) {
                        const name = trait.trim().split('\\').pop()?.trim();
                        if (name && /^[A-Z]/.test(name)) {
                            results.push(name);
                        }
                    }
                }
            }
        }

        return results;
    }

    private extractClassNamesFromDocType(typeExpr: string): string[] {
        const results: string[] = [];
        const parts = typeExpr.split(/[|&<>,\[\](){}:?]/);
        for (const part of parts) {
            let name = part.trim();
            name = name.split('\\').pop()?.trim() || '';
            if (name && /^[A-Z]/.test(name) && !isScalarType(name)) {
                results.push(name);
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
            trimmed = trimmed.replace(/[()]/g, '');
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
            let trimmed = part.trim();
            if (!trimmed) { continue; }

            // Strip PHP 8 attributes (e.g. #[CurrentUser], #[MapQueryString(validationGroups: ["strict"])])
            trimmed = trimmed.replace(/#\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\]\s*/g, '');

            // Strip constructor promotion modifiers
            trimmed = trimmed.replace(/^(?:public|protected|private)\s+/, '');
            trimmed = trimmed.replace(/^readonly\s+/, '');

            const typeMatch = trimmed.match(/^([\w\s|&?\\()]+?)\s*(?:\.{3})?\s*\$/);
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

const SCALAR_TYPES = new Set([
    'String', 'Int', 'Float', 'Bool', 'Array', 'Object',
    'Null', 'Void', 'Never', 'Mixed', 'Self', 'Static', 'Parent',
    'True', 'False', 'Iterable', 'Callable',
]);

function isScalarType(name: string): boolean {
    return SCALAR_TYPES.has(name);
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
