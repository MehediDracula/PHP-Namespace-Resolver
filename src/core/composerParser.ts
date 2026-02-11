import { ComposerAutoload, PsrMapping } from '../types';

export function parseAutoload(composerJson: any): ComposerAutoload {
    const psr4: PsrMapping[] = [];
    const psr0: PsrMapping[] = [];

    const autoload = composerJson.autoload || {};
    const autoloadDev = composerJson['autoload-dev'] || {};

    const psr4Config = { ...autoload['psr-4'], ...autoloadDev['psr-4'] };
    for (const [ns, paths] of Object.entries(psr4Config)) {
        const normalizedPaths = Array.isArray(paths) ? paths : [paths as string];
        psr4.push({
            namespace: ns.replace(/\\$/, ''),
            paths: normalizedPaths.map(p => p.replace(/\/$/, '')),
        });
    }

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

export function resolveNamespace(relativePath: string, autoload: ComposerAutoload): string | null {
    const normalizedRelPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';

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
