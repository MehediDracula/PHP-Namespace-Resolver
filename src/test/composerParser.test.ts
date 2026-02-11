import { parseAutoload, resolveNamespace } from '../core/composerParser';
import * as assert from 'assert';

describe('parseAutoload', () => {
    it('should parse PSR-4 autoload config', () => {
        const composer = {
            autoload: {
                'psr-4': {
                    'App\\': 'src/',
                }
            }
        };
        const result = parseAutoload(composer);
        assert.strictEqual(result.psr4.length, 1);
        assert.strictEqual(result.psr4[0].namespace, 'App');
        assert.deepStrictEqual(result.psr4[0].paths, ['src']);
    });

    it('should strip trailing backslash from namespace', () => {
        const composer = {
            autoload: {
                'psr-4': { 'App\\Models\\': 'src/Models/' }
            }
        };
        const result = parseAutoload(composer);
        assert.strictEqual(result.psr4[0].namespace, 'App\\Models');
    });

    it('should strip trailing slash from paths', () => {
        const composer = {
            autoload: {
                'psr-4': { 'App\\': 'src/' }
            }
        };
        const result = parseAutoload(composer);
        assert.deepStrictEqual(result.psr4[0].paths, ['src']);
    });

    it('should handle array of paths', () => {
        const composer = {
            autoload: {
                'psr-4': { 'App\\': ['src/', 'lib/'] }
            }
        };
        const result = parseAutoload(composer);
        assert.deepStrictEqual(result.psr4[0].paths, ['src', 'lib']);
    });

    it('should merge autoload and autoload-dev', () => {
        const composer = {
            autoload: {
                'psr-4': { 'App\\': 'src/' }
            },
            'autoload-dev': {
                'psr-4': { 'Tests\\': 'tests/' }
            }
        };
        const result = parseAutoload(composer);
        assert.strictEqual(result.psr4.length, 2);
        assert.strictEqual(result.psr4[0].namespace, 'App');
        assert.strictEqual(result.psr4[1].namespace, 'Tests');
    });

    it('should parse PSR-0 autoload config', () => {
        const composer = {
            autoload: {
                'psr-0': {
                    'Legacy\\': 'lib/'
                }
            }
        };
        const result = parseAutoload(composer);
        assert.strictEqual(result.psr0.length, 1);
        assert.strictEqual(result.psr0[0].namespace, 'Legacy');
        assert.deepStrictEqual(result.psr0[0].paths, ['lib']);
    });

    it('should handle both PSR-4 and PSR-0 together', () => {
        const composer = {
            autoload: {
                'psr-4': { 'App\\': 'src/' },
                'psr-0': { 'Legacy\\': 'lib/' }
            }
        };
        const result = parseAutoload(composer);
        assert.strictEqual(result.psr4.length, 1);
        assert.strictEqual(result.psr0.length, 1);
    });

    it('should return empty arrays for missing autoload sections', () => {
        const result = parseAutoload({});
        assert.strictEqual(result.psr4.length, 0);
        assert.strictEqual(result.psr0.length, 0);
    });

    it('should handle multiple PSR-4 entries', () => {
        const composer = {
            autoload: {
                'psr-4': {
                    'App\\': 'app/',
                    'Database\\': 'database/',
                    'Domain\\': 'src/Domain/'
                }
            }
        };
        const result = parseAutoload(composer);
        assert.strictEqual(result.psr4.length, 3);
    });
});

describe('resolveNamespace', () => {
    it('should resolve PSR-4 namespace from root path', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-4': { 'App\\': 'src/' } }
        });
        const result = resolveNamespace('/src', autoload);
        assert.strictEqual(result, 'App');
    });

    it('should resolve PSR-4 namespace from nested path', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-4': { 'App\\': 'src/' } }
        });
        const result = resolveNamespace('/src/Models', autoload);
        assert.strictEqual(result, 'App\\Models');
    });

    it('should resolve deeply nested paths', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-4': { 'App\\': 'src/' } }
        });
        const result = resolveNamespace('/src/Http/Controllers/Api', autoload);
        assert.strictEqual(result, 'App\\Http\\Controllers\\Api');
    });

    it('should resolve PSR-0 namespace', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-0': { 'Legacy\\': 'lib/' } }
        });
        const result = resolveNamespace('/lib/Legacy/Util', autoload);
        assert.strictEqual(result, 'Legacy\\Util');
    });

    it('should prefer PSR-4 over PSR-0', () => {
        const autoload = parseAutoload({
            autoload: {
                'psr-4': { 'App\\': 'src/' },
                'psr-0': { 'App\\': 'src/' }
            }
        });
        const result = resolveNamespace('/src/Models', autoload);
        assert.strictEqual(result, 'App\\Models');
    });

    it('should return null for unmatched paths', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-4': { 'App\\': 'src/' } }
        });
        const result = resolveNamespace('/vendor/something', autoload);
        assert.strictEqual(result, null);
    });

    it('should handle Laravel-style app directory', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-4': { 'App\\': 'app/' } }
        });
        assert.strictEqual(resolveNamespace('/app/Http/Controllers', autoload), 'App\\Http\\Controllers');
        assert.strictEqual(resolveNamespace('/app/Models', autoload), 'App\\Models');
        assert.strictEqual(resolveNamespace('/app', autoload), 'App');
    });

    it('should handle autoload-dev test namespaces', () => {
        const autoload = parseAutoload({
            autoload: { 'psr-4': { 'App\\': 'src/' } },
            'autoload-dev': { 'psr-4': { 'Tests\\': 'tests/' } }
        });
        assert.strictEqual(resolveNamespace('/tests/Unit', autoload), 'Tests\\Unit');
        assert.strictEqual(resolveNamespace('/tests/Feature', autoload), 'Tests\\Feature');
    });
});
