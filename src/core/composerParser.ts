import { ComposerAutoload, PsrMapping } from '../types';

/**
 * Parse composer.json autoload sections into normalized PsrMapping arrays.
 * Handles both autoload and autoload-dev, PSR-4 and PSR-0.
 */
export function parseAutoload(composerJson: any): ComposerAutoload {
    const psr4: PsrMapping[] = [];
    const psr0: PsrMapping[] = [];

    const autoload = composerJson.autoload || {};
    const autoloadDev = composerJson['autoload-dev'] || {};

    // PSR-4
    const psr4Config = { ...autoload['psr-4'], ...autoloadDev['psr-4'] };
    for (const [ns, paths] of Object.entries(psr4Config)) {
        const normalizedPaths = Array.isArray(paths) ? paths : [paths as string];
        psr4.push({
            namespace: ns.replace(/\\$/, ''),
            paths: normalizedPaths.map(p => p.replace(/\/$/, '')),
        });
    }

    // PSR-0
    const psr0Config = { ...autoload['psr-0'], ...autoloadDev['psr-0'] };
    for (const [ns, paths] of Object.entries(psr0Config)) {
        const normalizedPaths = Array.isArray(paths) ? paths : [paths as string];
        psr0.push({
            namespace: ns.replace(/\\$/, ''),
            paths: normalizedPaths.map(p => p.replace(/\/$/, '')),
        });
    }

    return { psr4, psr0 };
}

/**
 * Resolve a namespace from a relative file path using PSR-4 or PSR-0 mappings.
 * Returns null if no mapping matches.
 */
export function resolveNamespace(relativePath: string, autoload: ComposerAutoload): string | null {
    const normalizedRelPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';

    // Try PSR-4 first
    for (const mapping of autoload.psr4) {
        for (const basePath of mapping.paths) {
            const normalizedBasePath = '/' + basePath + '/';
            const idx = normalizedRelPath.indexOf(normalizedBasePath);

            if (idx !== -1) {
                const remaining = normalizedRelPath.substring(idx + normalizedBasePath.length);
                const namespaceSuffix = remaining
                    .replace(/^\//, '')
                    .replace(/\/$/, '')
                    .replace(/\//g, '\\');

                return namespaceSuffix
                    ? `${mapping.namespace}\\${namespaceSuffix}`
                    : mapping.namespace;
            }
        }
    }

    // Try PSR-0
    for (const mapping of autoload.psr0) {
        for (const basePath of mapping.paths) {
            const normalizedBasePath = '/' + basePath + '/';
            const idx = normalizedRelPath.indexOf(normalizedBasePath);

            if (idx !== -1) {
                const remaining = normalizedRelPath.substring(idx + normalizedBasePath.length);
                const namespaceSuffix = remaining
                    .replace(/^\//, '')
                    .replace(/\/$/, '')
                    .replace(/\//g, '\\');

                return namespaceSuffix || mapping.namespace;
            }
        }
    }

    return null;
}
