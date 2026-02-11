import { PhpClassDetector } from '../core/PhpClassDetector';
import * as assert from 'assert';

const detector = new PhpClassDetector();

describe('PhpClassDetector', () => {
    describe('getExtended', () => {
        it('should detect classes after extends keyword', () => {
            const text = 'class UserController extends Controller {';
            assert.deepStrictEqual(detector.getExtended(text), ['Controller']);
        });

        it('should detect multiple extends across lines', () => {
            const text = `class A extends Base {}\nclass B extends Other {}`;
            assert.deepStrictEqual(detector.getExtended(text), ['Base', 'Other']);
        });
    });

    describe('getImplemented', () => {
        it('should detect single interface', () => {
            const text = 'class User implements JsonSerializable {';
            assert.deepStrictEqual(detector.getImplemented(text), ['JsonSerializable']);
        });

        it('should detect multiple interfaces', () => {
            const text = 'class User implements Countable, Serializable {';
            const result = detector.getImplemented(text);
            assert.ok(result.includes('Countable'));
            assert.ok(result.includes('Serializable'));
        });
    });

    describe('getFromFunctionParameters', () => {
        it('should detect simple type hints', () => {
            const text = 'function handle(Request $request) {}';
            assert.deepStrictEqual(detector.getFromFunctionParameters(text), ['Request']);
        });

        it('should detect multiple parameter type hints', () => {
            const text = 'function handle(Request $request, Response $response) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('Response'));
        });

        it('should detect union types (PHP 8.0)', () => {
            const text = 'function handle(Request|Response $input) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('Response'));
        });

        it('should detect intersection types (PHP 8.1)', () => {
            const text = 'function process(Countable&Iterator $col) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Countable'));
            assert.ok(result.includes('Iterator'));
        });

        it('should detect nullable types', () => {
            const text = 'function find(?User $user) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('User'));
        });

        it('should ignore scalar types', () => {
            const text = 'function foo(string $a, int $b) {}';
            assert.deepStrictEqual(detector.getFromFunctionParameters(text), []);
        });
    });

    describe('getReturnTypes', () => {
        it('should detect simple return types', () => {
            const text = 'function getUser(): User {';
            assert.deepStrictEqual(detector.getReturnTypes(text), ['User']);
        });

        it('should detect nullable return types', () => {
            const text = 'function find(): ?Collection {';
            assert.deepStrictEqual(detector.getReturnTypes(text), ['Collection']);
        });

        it('should detect union return types', () => {
            const text = 'function get(): User|Response {';
            const result = detector.getReturnTypes(text);
            assert.ok(result.includes('User'));
            assert.ok(result.includes('Response'));
        });
    });

    describe('getPropertyTypes', () => {
        it('should detect typed properties', () => {
            const text = 'private UserService $service;';
            assert.deepStrictEqual(detector.getPropertyTypes(text), ['UserService']);
        });

        it('should detect readonly promoted constructor params', () => {
            const text = 'public readonly UserRepository $repo,';
            assert.deepStrictEqual(detector.getPropertyTypes(text), ['UserRepository']);
        });

        it('should detect nullable typed properties', () => {
            const text = 'protected ?Logger $logger;';
            assert.deepStrictEqual(detector.getPropertyTypes(text), ['Logger']);
        });
    });

    describe('getInitializedWithNew', () => {
        it('should detect new instantiations', () => {
            const text = 'new UserService()';
            assert.deepStrictEqual(detector.getInitializedWithNew(text), ['UserService']);
        });
    });

    describe('getFromStaticCalls', () => {
        it('should detect static method calls', () => {
            const text = 'User::find(1)';
            assert.deepStrictEqual(detector.getFromStaticCalls(text), ['User']);
        });

        it('should detect constant access', () => {
            const text = 'Carbon::now()';
            assert.deepStrictEqual(detector.getFromStaticCalls(text), ['Carbon']);
        });
    });

    describe('getFromInstanceof', () => {
        it('should detect instanceof checks', () => {
            const text = 'if ($user instanceof Admin)';
            assert.deepStrictEqual(detector.getFromInstanceof(text), ['Admin']);
        });
    });

    describe('getFromCatchBlocks', () => {
        it('should detect single catch type', () => {
            const text = 'catch (NotFoundException $e)';
            assert.deepStrictEqual(detector.getFromCatchBlocks(text), ['NotFoundException']);
        });

        it('should detect multi-catch types (PHP 8.0)', () => {
            const text = 'catch (NotFoundException | AuthorizationException $e)';
            const result = detector.getFromCatchBlocks(text);
            assert.ok(result.includes('NotFoundException'));
            assert.ok(result.includes('AuthorizationException'));
        });
    });

    describe('getFromAttributes', () => {
        it('should detect PHP 8 attributes', () => {
            const text = '#[Route("/api")]';
            assert.deepStrictEqual(detector.getFromAttributes(text), ['Route']);
        });

        it('should detect namespaced attributes', () => {
            const text = '#[ORM\\Entity]';
            assert.deepStrictEqual(detector.getFromAttributes(text), ['Entity']);
        });
    });

    describe('getEnumImplements', () => {
        it('should detect interfaces on enum declarations', () => {
            const text = 'enum Status: string implements HasLabel {';
            assert.deepStrictEqual(detector.getEnumImplements(text), ['HasLabel']);
        });

        it('should detect multiple interfaces on enums', () => {
            const text = 'enum Color implements Colorable, Stringable {';
            const result = detector.getEnumImplements(text);
            assert.ok(result.includes('Colorable'));
            assert.ok(result.includes('Stringable'));
        });
    });

    describe('edge cases - false positive prevention', () => {
        it('should not detect lowercase variable-like words', () => {
            const text = 'function handle(string $request) {}';
            assert.deepStrictEqual(detector.getFromFunctionParameters(text), []);
        });

        it('should not detect scalar return types', () => {
            const text = 'function count(): int {';
            assert.deepStrictEqual(detector.getReturnTypes(text), []);
        });

        it('should not detect void return type', () => {
            const text = 'function save(): void {';
            assert.deepStrictEqual(detector.getReturnTypes(text), []);
        });

        it('should not detect mixed return type', () => {
            const text = 'function get(): mixed {';
            assert.deepStrictEqual(detector.getReturnTypes(text), []);
        });

        it('should not detect self or static as types to import', () => {
            const text = 'function create(): static {';
            assert.deepStrictEqual(detector.getReturnTypes(text), []);
        });

        it('should handle union types with scalars mixed in', () => {
            const text = 'function get(): string|Collection {';
            const result = detector.getReturnTypes(text);
            assert.ok(result.includes('Collection'));
            assert.ok(!result.includes('string'));
            assert.strictEqual(result.length, 1);
        });

        it('should handle nullable union with scalar', () => {
            const text = 'function find(?int $id, ?User $user) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('User'));
            assert.ok(!result.includes('int'));
        });
    });

    describe('edge cases - multiline and complex patterns', () => {
        it('should detect types in multiline function parameters', () => {
            const text = `function handle(
    Request $request,
    Response $response
) {}`;
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('Response'));
        });

        it('should detect abstract class inheritance', () => {
            const text = 'abstract class BaseController extends Controller {';
            assert.deepStrictEqual(detector.getExtended(text), ['Controller']);
        });

        it('should detect final class inheritance', () => {
            const text = 'final class UserService extends Service {';
            assert.deepStrictEqual(detector.getExtended(text), ['Service']);
        });

        it('should detect static property types', () => {
            const text = 'private static Collection $items;';
            assert.deepStrictEqual(detector.getPropertyTypes(text), ['Collection']);
        });

        it('should detect multiple new instantiations on same line', () => {
            const text = '$a = new Foo(); $b = new Bar();';
            const result = detector.getInitializedWithNew(text);
            assert.ok(result.includes('Foo'));
            assert.ok(result.includes('Bar'));
        });

        it('should detect multiple static calls on same line', () => {
            const text = '$result = Cache::get("key") ?? Config::get("default");';
            const result = detector.getFromStaticCalls(text);
            assert.ok(result.includes('Cache'));
            assert.ok(result.includes('Config'));
        });

        it('should detect multiple attributes on separate lines', () => {
            const text = `#[Route("/api")]
#[Middleware("auth")]
public function index() {}`;
            const result = detector.getFromAttributes(text);
            assert.ok(result.includes('Route'));
            assert.ok(result.includes('Middleware'));
        });

        it('should detect attribute with complex arguments', () => {
            const text = '#[Assert\\NotBlank(message: "Required")]';
            const result = detector.getFromAttributes(text);
            assert.ok(result.includes('NotBlank'));
        });

        it('should detect FQCN catch blocks', () => {
            const text = 'catch (\\App\\Exceptions\\NotFoundException $e)';
            const result = detector.getFromCatchBlocks(text);
            assert.ok(result.includes('NotFoundException'));
        });
    });

    describe('edge cases - enum detection', () => {
        it('should detect basic backed enum', () => {
            const text = 'enum Status: string implements HasLabel {';
            const result = detector.getEnumImplements(text);
            assert.deepStrictEqual(result, ['HasLabel']);
        });

        it('should detect unit enum with implements', () => {
            const text = 'enum Direction implements Printable {';
            const result = detector.getEnumImplements(text);
            assert.deepStrictEqual(result, ['Printable']);
        });
    });

    describe('detectAllWithPositions', () => {
        it('should return positions for detected classes', () => {
            const text = `<?php

class Foo extends Bar {
    public function test(): Baz {}
}`;
            const results = detector.detectAllWithPositions(text);
            assert.ok(results.length > 0);

            const barResult = results.find(r => r.name === 'Bar');
            assert.ok(barResult);
            assert.strictEqual(barResult!.line, 2);

            const bazResult = results.find(r => r.name === 'Baz');
            assert.ok(bazResult);
            assert.strictEqual(bazResult!.line, 3);
        });

        it('should skip classes on namespace and use lines', () => {
            const text = `<?php
namespace App\\Controllers;
use App\\Models\\User;

class UserController extends Controller {
    public function show(): User {}
}`;
            const results = detector.detectAllWithPositions(text);

            // User should appear only from the method return type, not from the use statement
            const userPositions = results.filter(r => r.name === 'User');
            for (const pos of userPositions) {
                assert.notStrictEqual(pos.line, 1); // not namespace line
                assert.notStrictEqual(pos.line, 2); // not use line
            }
        });
    });

    describe('edge cases - empty and boundary inputs', () => {
        it('should return empty array for empty text', () => {
            assert.deepStrictEqual(detector.detectAll(''), []);
        });

        it('should return empty array for detectAllWithPositions on empty text', () => {
            assert.deepStrictEqual(detector.detectAllWithPositions(''), []);
        });

        it('should deduplicate same class at same position in detectAllWithPositions', () => {
            const text = `<?php

class Foo extends Bar {
    public function test(): Bar {}
}`;
            const results = detector.detectAllWithPositions(text);
            // Bar should only appear once per unique position
            const barResults = results.filter(r => r.name === 'Bar');
            const uniqueKeys = new Set(barResults.map(r => `${r.name}:${r.line}:${r.character}`));
            assert.strictEqual(barResults.length, uniqueKeys.size);
        });

        it('should detect property types with protected static readonly modifiers', () => {
            const text = 'protected static readonly Collection $items;';
            // The regex handles optional static then optional readonly
            assert.deepStrictEqual(detector.getPropertyTypes(text), ['Collection']);
        });

        it('should detect intersection types in property declarations', () => {
            const text = 'private Countable&Iterator $items;';
            const result = detector.getPropertyTypes(text);
            assert.ok(result.includes('Countable'));
            assert.ok(result.includes('Iterator'));
        });
    });

    describe('detectAll', () => {
        it('should return unique class names from all patterns', () => {
            const text = `<?php
namespace App\\Controllers;

use App\\Models\\User;

class UserController extends Controller implements JsonSerializable {
    private UserService $service;

    public function __construct(
        private readonly UserRepository $repo,
    ) {}

    #[Route("/users")]
    public function index(Request $request): Response {
        $user = new User();
        if ($user instanceof Admin) {}
        try {} catch (NotFoundException | AuthorizationException $e) {}
        return User::all();
    }
}`;
            const result = detector.detectAll(text);
            assert.ok(result.includes('Controller'));
            assert.ok(result.includes('JsonSerializable'));
            assert.ok(result.includes('UserService'));
            assert.ok(result.includes('UserRepository'));
            assert.ok(result.includes('Route'));
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('Response'));
            assert.ok(result.includes('User'));
            assert.ok(result.includes('Admin'));
            assert.ok(result.includes('NotFoundException'));
            assert.ok(result.includes('AuthorizationException'));
        });
    });
});
