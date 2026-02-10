import { builtInClasses } from '../data/builtInClasses';
import * as assert from 'assert';

describe('Built-in PHP Classes', () => {
    it('should contain core PHP classes', () => {
        assert.ok(builtInClasses.has('stdClass'));
        assert.ok(builtInClasses.has('Exception'));
        assert.ok(builtInClasses.has('DateTime'));
        assert.ok(builtInClasses.has('PDO'));
    });

    it('should contain PHP 8.0 additions', () => {
        assert.ok(builtInClasses.has('WeakMap'));
        assert.ok(builtInClasses.has('ValueError'));
        assert.ok(builtInClasses.has('UnhandledMatchError'));
        assert.ok(builtInClasses.has('Attribute'));
        assert.ok(builtInClasses.has('Stringable'));
    });

    it('should contain PHP 8.1 additions', () => {
        assert.ok(builtInClasses.has('Fiber'));
        assert.ok(builtInClasses.has('FiberError'));
        assert.ok(builtInClasses.has('BackedEnum'));
        assert.ok(builtInClasses.has('UnitEnum'));
        assert.ok(builtInClasses.has('ReflectionEnum'));
        assert.ok(builtInClasses.has('ReflectionFiber'));
        assert.ok(builtInClasses.has('ReflectionIntersectionType'));
    });

    it('should contain PHP 8.2 additions', () => {
        assert.ok(builtInClasses.has('AllowDynamicProperties'));
        assert.ok(builtInClasses.has('SensitiveParameter'));
    });

    it('should contain PHP 8.3 additions', () => {
        assert.ok(builtInClasses.has('Override'));
    });

    it('should contain common interfaces', () => {
        assert.ok(builtInClasses.has('Traversable'));
        assert.ok(builtInClasses.has('Iterator'));
        assert.ok(builtInClasses.has('ArrayAccess'));
        assert.ok(builtInClasses.has('Countable'));
        assert.ok(builtInClasses.has('JsonSerializable'));
        assert.ok(builtInClasses.has('Throwable'));
    });

    it('should contain SPL classes', () => {
        assert.ok(builtInClasses.has('ArrayObject'));
        assert.ok(builtInClasses.has('SplFileInfo'));
        assert.ok(builtInClasses.has('SplStack'));
        assert.ok(builtInClasses.has('SplQueue'));
    });

    it('should not contain user-space classes', () => {
        assert.ok(!builtInClasses.has('Controller'));
        assert.ok(!builtInClasses.has('Request'));
        assert.ok(!builtInClasses.has('Model'));
    });
});
