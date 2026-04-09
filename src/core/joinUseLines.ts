import { UseStatement } from '../types';

/**
 * Join deduped, sorted `use` lines for one kind bucket. When `separate` is true, inserts an extra
 * blank line between adjacent lines whose FQCN root (first namespace segment) differs.
 */
export function joinUseLinesWithOptionalNamespaceGaps(stmts: UseStatement[], separate: boolean): string {
    if (stmts.length === 0) {
        return '';
    }
    if (!separate) {
        return stmts.map(s => s.text).join('\n');
    }

    let out = stmts[0].text;
    for (let i = 1; i < stmts.length; i++) {
        const sameRoot = namespaceRootForSortGrouping(stmts[i - 1].fqcn) === namespaceRootForSortGrouping(stmts[i].fqcn);
        out += (sameRoot ? '\n' : '\n\n') + stmts[i].text;
    }
    return out;
}

/** First segment of FQCN; lowercased so App and app group together for spacing decisions. */
function namespaceRootForSortGrouping(fqcn: string): string {
    const i = fqcn.indexOf('\\');
    return (i === -1 ? fqcn : fqcn.slice(0, i)).toLowerCase();
}
