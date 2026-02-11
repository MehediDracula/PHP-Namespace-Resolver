import { DeclarationLines, InsertPosition } from '../types';

/**
 * Determine where to insert a new use statement based on parsed declaration lines.
 * Pure function — no VS Code API dependency.
 */
export function getInsertPosition(declarationLines: DeclarationLines): InsertPosition {
    let prepend = declarationLines.phpTag === 0 ? '' : '\n';
    let append = '\n';
    let line = declarationLines.phpTag;

    if (prepend === '' && declarationLines.namespace !== null) {
        prepend = '\n';
    }

    if (declarationLines.lastUseStatement !== null) {
        prepend = '';
        line = declarationLines.lastUseStatement;
    } else if (declarationLines.namespace !== null) {
        line = declarationLines.namespace;
    }

    // Add extra newline if class declaration is directly adjacent
    if (declarationLines.classDeclaration !== null) {
        const classLine = declarationLines.classDeclaration;
        const refLine = declarationLines.lastUseStatement
            ?? declarationLines.namespace
            ?? declarationLines.phpTag;

        if (classLine - refLine <= 1) {
            append = '\n\n';
        }
    }

    return { line, prepend, append };
}
