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
