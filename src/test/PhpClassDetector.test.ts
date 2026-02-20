import { PhpClassDetector, sanitizePhpCode } from '../core/PhpClassDetector';
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

        it('should detect types after PHP attributes', () => {
            const text = 'function show(Request $request, #[CurrentUser] ?User $user) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('User'));
        });

        it('should detect types after multiple PHP attributes', () => {
            const text = 'function handle(#[MapEntity] #[CurrentUser] User $user) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('User'));
        });

        it('should detect types after attribute with arguments', () => {
            const text = 'function show(#[MapQueryString(validationGroups: ["strict"])] SearchFilter $filter) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('SearchFilter'));
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

    describe('getFromTraitUse', () => {
        it('should detect single trait usage inside a class', () => {
            const text = `class Foo {\n    use HasLogger;\n}`;
            assert.deepStrictEqual(detector.getFromTraitUse(text), ['HasLogger']);
        });

        it('should detect multiple traits on one line', () => {
            const text = `class Foo {\n    use HasLogger, Notifiable, SoftDeletes;\n}`;
            const result = detector.getFromTraitUse(text);
            assert.ok(result.includes('HasLogger'));
            assert.ok(result.includes('Notifiable'));
            assert.ok(result.includes('SoftDeletes'));
        });

        it('should not detect namespace use statements as traits', () => {
            const text = `use App\\Models\\User;\n\nclass Foo {\n    use HasLogger;\n}`;
            const result = detector.getFromTraitUse(text);
            assert.deepStrictEqual(result, ['HasLogger']);
        });

        it('should not detect closure use as trait', () => {
            const text = `$fn = function () use ($var) {};`;
            assert.deepStrictEqual(detector.getFromTraitUse(text), []);
        });

        it('should detect trait use with curly brace block (conflict resolution)', () => {
            const text = `class Foo {\n    use A, B {\n        B::method insteadof A;\n    }\n}`;
            const result = detector.getFromTraitUse(text);
            assert.ok(result.includes('A'));
            assert.ok(result.includes('B'));
        });

        it('should detect multi-line trait use statements', () => {
            const text = `class Foo {\n    use Sluggable,\n        HasMedia,\n        HasPreferences;\n}`;
            const result = detector.getFromTraitUse(text);
            assert.ok(result.includes('Sluggable'));
            assert.ok(result.includes('HasMedia'));
            assert.ok(result.includes('HasPreferences'));
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

    describe('getFromPhpDoc', () => {
        it('should detect @param types', () => {
            const text = `/**
 * @param User $user
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('User'));
        });

        it('should detect @return types', () => {
            const text = `/**
 * @return Collection
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('Collection'));
        });

        it('should detect @var types', () => {
            const text = `/** @var User $user */`;
            assert.ok(detector.getFromPhpDoc(text).includes('User'));
        });

        it('should detect @throws types', () => {
            const text = `/**
 * @throws NotFoundException
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('NotFoundException'));
        });

        it('should detect union types in PHPDoc', () => {
            const text = `/**
 * @param User|null $user
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('User'));
        });

        it('should detect generic types in PHPDoc', () => {
            const text = `/**
 * @return Collection<User>
 */`;
            const result = detector.getFromPhpDoc(text);
            assert.ok(result.includes('Collection'));
            assert.ok(result.includes('User'));
        });

        it('should detect @property types', () => {
            const text = `/**
 * @property Carbon $created_at
 * @property-read Collection $comments
 */`;
            const result = detector.getFromPhpDoc(text);
            assert.ok(result.includes('Carbon'));
            assert.ok(result.includes('Collection'));
        });

        it('should detect @mixin types', () => {
            const text = `/**
 * @mixin Builder
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('Builder'));
        });

        it('should detect @extends and @implements types', () => {
            const text = `/**
 * @extends Collection<User>
 * @implements Repository<Post>
 */`;
            const result = detector.getFromPhpDoc(text);
            assert.ok(result.includes('Collection'));
            assert.ok(result.includes('User'));
            assert.ok(result.includes('Repository'));
            assert.ok(result.includes('Post'));
        });

        it('should detect @template of constraint', () => {
            const text = `/**
 * @template T of Model
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('Model'));
        });

        it('should detect @method types', () => {
            const text = `/**
 * @method static Builder query()
 * @method User find(int $id)
 */`;
            const result = detector.getFromPhpDoc(text);
            assert.ok(result.includes('Builder'));
            assert.ok(result.includes('User'));
        });

        it('should detect @see references', () => {
            const text = `/**
 * @see UserController
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('UserController'));
        });

        it('should detect FQCN in PHPDoc and extract short name', () => {
            const text = `/**
 * @param \\App\\Models\\User $user
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('User'));
        });

        it('should not detect scalar types in PHPDoc', () => {
            const text = `/**
 * @param string $name
 * @return void
 */`;
            assert.deepStrictEqual(detector.getFromPhpDoc(text), []);
        });

        it('should detect array notation types', () => {
            const text = `/**
 * @return User[]
 */`;
            assert.ok(detector.getFromPhpDoc(text).includes('User'));
        });
    });

    describe('getFromTraitUse', () => {
        it('should detect single trait use', () => {
            const text = `class User extends Model {
    use HasFactory;
}`;
            assert.deepStrictEqual(detector.getFromTraitUse(text), ['HasFactory']);
        });

        it('should detect multiple trait use on same line', () => {
            const text = `class User extends Model {
    use HasFactory, SoftDeletes;
}`;
            const result = detector.getFromTraitUse(text);
            assert.ok(result.includes('HasFactory'));
            assert.ok(result.includes('SoftDeletes'));
        });

        it('should detect FQCN trait use and extract short name', () => {
            const text = `class User extends Model {
    use App\\Traits\\HasFactory;
}`;
            assert.deepStrictEqual(detector.getFromTraitUse(text), ['HasFactory']);
        });

        it('should not detect use statements before class declaration', () => {
            const text = `use App\\Models\\User;

class Foo {}`;
            assert.deepStrictEqual(detector.getFromTraitUse(text), []);
        });

        it('should detect trait use with conflict resolution', () => {
            const text = `class Foo {
    use TraitA, TraitB {
        TraitA::method as aliasMethod;
    }
}`;
            const result = detector.getFromTraitUse(text);
            assert.ok(result.includes('TraitA'));
            assert.ok(result.includes('TraitB'));
        });
    });

    describe('closure and arrow function detection', () => {
        it('should detect closure parameter types', () => {
            const text = 'function (Request $request) {}';
            assert.ok(detector.getFromFunctionParameters(text).includes('Request'));
        });

        it('should detect arrow function parameter types', () => {
            const text = 'fn(User $user) => $user->name';
            assert.ok(detector.getFromFunctionParameters(text).includes('User'));
        });

        it('should detect arrow function return types', () => {
            const text = 'fn(int $id): User => findUser($id)';
            assert.ok(detector.getReturnTypes(text).includes('User'));
        });

        it('should detect closure return types', () => {
            const text = 'function (int $id): Response {}';
            assert.ok(detector.getReturnTypes(text).includes('Response'));
        });
    });

    describe('constructor promotion detection', () => {
        it('should detect types with public modifier', () => {
            const text = 'function __construct(public User $user) {}';
            assert.ok(detector.getFromFunctionParameters(text).includes('User'));
        });

        it('should detect types with private readonly modifier', () => {
            const text = 'function __construct(private readonly Request $request) {}';
            assert.ok(detector.getFromFunctionParameters(text).includes('Request'));
        });

        it('should detect types with protected modifier', () => {
            const text = 'function __construct(protected Logger $logger) {}';
            assert.ok(detector.getFromFunctionParameters(text).includes('Logger'));
        });
    });

    describe('no-capture catch (PHP 8.0)', () => {
        it('should detect type in catch without variable', () => {
            const text = 'try {} catch (RuntimeException) {}';
            assert.ok(detector.getFromCatchBlocks(text).includes('RuntimeException'));
        });

        it('should detect union types in no-capture catch', () => {
            const text = 'try {} catch (InvalidArgumentException | LogicException) {}';
            const result = detector.getFromCatchBlocks(text);
            assert.ok(result.includes('InvalidArgumentException'));
            assert.ok(result.includes('LogicException'));
        });

        it('should still detect types in catch with variable', () => {
            const text = 'try {} catch (Exception $e) {}';
            assert.ok(detector.getFromCatchBlocks(text).includes('Exception'));
        });
    });

    describe('DNF types (PHP 8.2)', () => {
        it('should detect DNF types in parameters', () => {
            const text = 'function foo((Countable&Iterator)|null $items) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Countable'));
            assert.ok(result.includes('Iterator'));
        });

        it('should detect DNF types in return type', () => {
            const text = 'function foo(): (Stringable&Countable)|null {}';
            const result = detector.getReturnTypes(text);
            assert.ok(result.includes('Stringable'));
            assert.ok(result.includes('Countable'));
        });

        it('should detect DNF types in property type', () => {
            const text = 'private (Iterator&Countable)|null $items;';
            const result = detector.getPropertyTypes(text);
            assert.ok(result.includes('Iterator'));
            assert.ok(result.includes('Countable'));
        });
    });

    describe('variadic parameters', () => {
        it('should detect type of variadic parameter', () => {
            const text = 'function merge(Collection ...$collections) {}';
            assert.ok(detector.getFromFunctionParameters(text).includes('Collection'));
        });

        it('should detect type in mixed variadic and normal params', () => {
            const text = 'function foo(Request $request, Middleware ...$middleware) {}';
            const result = detector.getFromFunctionParameters(text);
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('Middleware'));
        });
    });

    describe('typed class constants (PHP 8.3)', () => {
        it('should detect typed constant', () => {
            const text = 'const Status STATUS_ACTIVE = "active";';
            assert.ok(detector.getFromTypedConstants(text).includes('Status'));
        });

        it('should detect typed constant with visibility', () => {
            const text = 'public const ResponseType DEFAULT_TYPE = "json";';
            assert.ok(detector.getFromTypedConstants(text).includes('ResponseType'));
        });

        it('should detect union typed constant', () => {
            const text = 'const ErrorCode|Status RESULT = null;';
            const result = detector.getFromTypedConstants(text);
            assert.ok(result.includes('ErrorCode'));
            assert.ok(result.includes('Status'));
        });
    });

    describe('interface multi-extends', () => {
        it('should detect multiple parent interfaces', () => {
            const text = 'interface Foo extends Countable, Serializable {';
            const result = detector.getExtended(text);
            assert.ok(result.includes('Countable'));
            assert.ok(result.includes('Serializable'));
        });

        it('should detect single interface extend', () => {
            const text = 'interface Foo extends JsonSerializable {';
            assert.ok(detector.getExtended(text).includes('JsonSerializable'));
        });
    });

    describe('readonly class (PHP 8.2)', () => {
        it('should detect trait use inside readonly class', () => {
            const text = `readonly class User extends Model {
    use HasFactory;
}`;
            assert.ok(detector.getFromTraitUse(text).includes('HasFactory'));
        });

        it('should detect trait use inside final readonly class', () => {
            const text = `final readonly class Config {
    use Singleton;
}`;
            assert.ok(detector.getFromTraitUse(text).includes('Singleton'));
        });
    });

    describe('asymmetric visibility (PHP 8.4)', () => {
        it('should detect property type with asymmetric set visibility', () => {
            const text = 'public private(set) User $user;';
            assert.ok(detector.getPropertyTypes(text).includes('User'));
        });

        it('should detect property type with protected(set)', () => {
            const text = 'public protected(set) Collection $items;';
            assert.ok(detector.getPropertyTypes(text).includes('Collection'));
        });
    });

    describe('multiple attributes in one block', () => {
        it('should detect multiple comma-separated attributes', () => {
            const text = '#[Route("/api"), Middleware("auth")]';
            const result = detector.getFromAttributes(text);
            assert.ok(result.includes('Route'));
            assert.ok(result.includes('Middleware'));
        });

        it('should detect single attribute', () => {
            const text = '#[Override]';
            assert.ok(detector.getFromAttributes(text).includes('Override'));
        });
    });

    describe('property hook set params (PHP 8.4)', () => {
        it('should detect type in property hook set parameter', () => {
            const text = `set(User $value) {
    $this->user = $value;
}`;
            assert.ok(detector.getFromFunctionParameters(text).includes('User'));
        });
    });

    describe('sanitizePhpCode', () => {
        it('should blank out single-quoted strings', () => {
            const text = `$x = 'new Foo()';`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.strictEqual(result.length, text.length);
        });

        it('should blank out double-quoted strings', () => {
            const text = `$x = "new Bar()";`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Bar'));
            assert.strictEqual(result.length, text.length);
        });

        it('should handle escaped quotes in strings', () => {
            const text = `$x = 'it\\'s a Foo'; $y = "a \\"Bar\\"";`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(!result.includes('Bar'));
        });

        it('should blank out single-line // comments', () => {
            const text = `$x = 1; // new Foo()`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(result.startsWith('$x = 1;'));
        });

        it('should blank out single-line # comments but not #[ attributes', () => {
            const text = `# new Foo()\n#[Route]`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(result.includes('#[Route]'));
        });

        it('should blank out all block comments including PHPDoc', () => {
            const text = `/* new Foo() */\n/** @param Bar $b */`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(!result.includes('Bar'));
            assert.strictEqual(result.length, text.length);
        });

        it('should blank out entire PHPDoc blocks', () => {
            const text = `/**\n * Returns a Logger or Formatter based on the config\n * @param Request $request\n */`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Logger'));
            assert.ok(!result.includes('Formatter'));
            assert.ok(!result.includes('Request'));
            assert.strictEqual(result.length, text.length);
        });

        it('should blank out heredoc content', () => {
            const text = `$x = <<<EOT\nnew Foo()\nEOT;`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.strictEqual(result.length, text.length);
        });

        it('should blank out nowdoc content', () => {
            const text = `$x = <<<'EOT'\nnew Foo()\nEOT;`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
        });

        it('should blank out indented heredoc (PHP 7.3+ flexible syntax)', () => {
            const text = `$x = <<<EOT\n    new Foo()\n    EOT;`;
            const result = sanitizePhpCode(text);
            assert.ok(!result.includes('Foo'));
            assert.strictEqual(result.length, text.length);
        });

        it('should preserve newlines for position accuracy', () => {
            const text = `"line1\nline2"\n$real = 1;`;
            const result = sanitizePhpCode(text);
            const originalLines = text.split('\n').length;
            const resultLines = result.split('\n').length;
            assert.strictEqual(resultLines, originalLines);
        });

        it('should preserve same length as original', () => {
            const text = `$x = "Foo"; // Bar\n/* Baz */\n/** @param Qux $q */`;
            const result = sanitizePhpCode(text);
            assert.strictEqual(result.length, text.length);
        });
    });

    describe('detectAll - string/comment filtering', () => {
        it('should not detect class names inside single-quoted strings', () => {
            const text = `<?php\n$x = 'new Foo()';`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('Foo'));
        });

        it('should not detect class names inside double-quoted strings', () => {
            const text = `<?php\n$x = "Carbon::now()";`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('Carbon'));
        });

        it('should not detect class names in single-line comments', () => {
            const text = `<?php\n// new Foo()\n$x = new Bar();`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(result.includes('Bar'));
        });

        it('should not detect class names in block comments', () => {
            const text = `<?php\n/* new Foo() */\n$x = new Bar();`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(result.includes('Bar'));
        });

        it('should still detect class names in PHPDoc comments', () => {
            const text = `<?php\n/** @param Foo $f */\nfunction test(Bar $b) {}`;
            const result = detector.detectAll(text);
            assert.ok(result.includes('Foo'));
            assert.ok(result.includes('Bar'));
        });

        it('should not detect class names in heredoc', () => {
            const text = `<?php\n$x = <<<EOT\nnew Foo()\nEOT;\n$y = new Bar();`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('Foo'));
            assert.ok(result.includes('Bar'));
        });

        it('should not detect class names in # comments', () => {
            const text = `<?php\n# Carbon::now()\n$x = new Bar();`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('Carbon'));
            assert.ok(result.includes('Bar'));
        });

        it('should not detect class names in PHPDoc free-text descriptions', () => {
            const text = `<?php
/**
 * Returns a Logger or Formatter based on the config
 */
public function getHandler()
{
    $h = new Logger();
}`;
            const result = detector.detectAll(text);
            // Logger is detected from `new Logger()` in code
            assert.ok(result.includes('Logger'));
            // Formatter only appears in PHPDoc free-text, should NOT be detected
            assert.ok(!result.includes('Formatter'));
        });

        it('should not detect class names from code patterns in PHPDoc @tag lines', () => {
            const text = `<?php
/**
 * @deprecated Use NewService::create() instead
 */
class Foo {}`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('NewService'));
        });

        it('should handle mixed strings, comments, and real code', () => {
            const text = `<?php
class Foo extends Controller {
    public function test(Request $req): Response {
        // Logger::info("test")
        $msg = "instanceof Admin";
        /* new Cache() */
        $x = new Service();
    }
}`;
            const result = detector.detectAll(text);
            assert.ok(result.includes('Controller'));
            assert.ok(result.includes('Request'));
            assert.ok(result.includes('Response'));
            assert.ok(result.includes('Service'));
            assert.ok(!result.includes('Logger'));
            assert.ok(!result.includes('Admin'));
            assert.ok(!result.includes('Cache'));
        });
    });

    describe('detectAllWithPositions - string/comment filtering', () => {
        it('should not return positions for class names inside strings', () => {
            const text = `<?php\n$x = "new Foo()";\n$y = new Foo();`;
            const results = detector.detectAllWithPositions(text);
            const fooResults = results.filter(r => r.name === 'Foo');
            // Should only find Foo on line 2 (the real code), not line 1 (the string)
            assert.strictEqual(fooResults.length, 1);
            assert.strictEqual(fooResults[0].line, 2);
        });

        it('should not return positions for class names inside comments', () => {
            const text = `<?php\n// new Bar()\n$y = new Bar();`;
            const results = detector.detectAllWithPositions(text);
            const barResults = results.filter(r => r.name === 'Bar');
            assert.strictEqual(barResults.length, 1);
            assert.strictEqual(barResults[0].line, 2);
        });

        it('should not return positions for class names in PHPDoc free-text (#124)', () => {
            const text = `<?php
/**
 * Returns a Logger or Formatter based on the config
 */
public function getHandler()
{
    $h = new Logger();
}`;
            const results = detector.detectAllWithPositions(text);
            const loggerResults = results.filter(r => r.name === 'Logger');
            // Logger should only appear from line 6 (new Logger()), not line 2 (PHPDoc description)
            assert.strictEqual(loggerResults.length, 1);
            assert.strictEqual(loggerResults[0].line, 6);
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

        it('should detect classes from PHPDoc and trait use in detectAll', () => {
            const text = `<?php

/**
 * @mixin Builder
 */
class User extends Model {
    use HasFactory, SoftDeletes;

    /**
     * @return Collection<Post>
     */
    public function posts() {}
}`;
            const result = detector.detectAll(text);
            assert.ok(result.includes('Builder'));
            assert.ok(result.includes('Model'));
            assert.ok(result.includes('HasFactory'));
            assert.ok(result.includes('SoftDeletes'));
            assert.ok(result.includes('Collection'));
            assert.ok(result.includes('Post'));
        });
    });

    describe('detectAll - FQCN filtering', () => {
        it('should not detect classes only used as fully qualified names', () => {
            const text = `<?php
namespace App\\Http;

class Kernel extends HttpKernel {
    protected $middleware = [
        \\App\\Http\\Middleware\\CheckForMaintenanceMode::class,
        \\Illuminate\\Foundation\\Http\\Middleware\\ValidatePostSize::class,
    ];
}`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('CheckForMaintenanceMode'));
            assert.ok(!result.includes('ValidatePostSize'));
            assert.ok(result.includes('HttpKernel'));
        });

        it('should detect class used both as FQCN and short name', () => {
            const text = `<?php
class Foo {
    protected $list = [
        \\App\\Models\\User::class,
    ];
    public function bar(User $user) {}
}`;
            const result = detector.detectAll(text);
            assert.ok(result.includes('User'));
        });

        it('should detect class used only as short name', () => {
            const text = `<?php
class Foo {
    public function bar(): Response {
        return Response::make();
    }
}`;
            const result = detector.detectAll(text);
            assert.ok(result.includes('Response'));
        });

        it('should not detect classes from FQCN type hints', () => {
            const text = `<?php
class Foo {
    public function bar(\\App\\Models\\User $user): \\App\\Http\\Response {}
}`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('User'));
            assert.ok(!result.includes('Response'));
        });

        it('should not detect classes from FQCN in catch blocks', () => {
            const text = `<?php
class Foo {
    public function bar() {
        try {} catch (\\App\\Exceptions\\CustomException $e) {}
    }
}`;
            const result = detector.detectAll(text);
            assert.ok(!result.includes('CustomException'));
        });
    });
});
