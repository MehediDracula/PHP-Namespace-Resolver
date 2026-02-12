import * as assert from 'assert';
import { DeclarationParser } from '../../core/DeclarationParser';
import { openEditor, createDocument } from './helper';

suite('DeclarationParser (VS Code Integration)', () => {
    const parser = new DeclarationParser();

    test('should parse PHP tag line', async () => {
        const doc = await createDocument('<?php\n\nclass Foo {}');
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.phpTag, 1);
    });

    test('should parse namespace line', async () => {
        const doc = await createDocument('<?php\n\nnamespace App\\Controllers;\n\nclass Foo {}');
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.namespace, 3);
    });

    test('should parse use statements', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App;\n\nuse Illuminate\\Http\\Request;\nuse App\\Models\\User;\n\nclass Foo {}'
        );
        const { useStatements, declarationLines } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 2);
        assert.strictEqual(useStatements[0].className, 'Request');
        assert.strictEqual(useStatements[0].fqcn, 'Illuminate\\Http\\Request');
        assert.strictEqual(useStatements[1].className, 'User');
        assert.strictEqual(declarationLines.firstUseStatement, 5);
        assert.strictEqual(declarationLines.lastUseStatement, 6);
    });

    test('should parse use statement with alias', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User as AppUser;\n\nclass Foo {}'
        );
        const { useStatements } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 1);
        assert.strictEqual(useStatements[0].alias, 'AppUser');
        assert.strictEqual(useStatements[0].className, 'AppUser');
        assert.strictEqual(useStatements[0].fqcn, 'App\\Models\\User');
    });

    test('should parse class declaration line', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App;\n\nuse Foo\\Bar;\n\nclass MyController extends Controller {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.classDeclaration, 7);
    });

    test('should detect abstract class declarations', async () => {
        const doc = await createDocument(
            '<?php\n\nabstract class BaseController {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.classDeclaration, 3);
    });

    test('should detect interface declarations', async () => {
        const doc = await createDocument(
            '<?php\n\ninterface UserRepository {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.classDeclaration, 3);
    });

    test('should detect trait declarations', async () => {
        const doc = await createDocument(
            '<?php\n\ntrait HasTimestamps {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.classDeclaration, 3);
    });

    test('should detect enum declarations', async () => {
        const doc = await createDocument(
            '<?php\n\nenum Status: string {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.classDeclaration, 3);
    });

    test('should throw when class is already imported', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {}'
        );
        assert.throws(
            () => parser.parse(doc, 'App\\Models\\User'),
            /already imported/
        );
    });

    test('should not throw when class is not yet imported', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\Post;\n\nclass Foo {}'
        );
        assert.doesNotThrow(() => parser.parse(doc, 'App\\Models\\User'));
    });

    test('should not match closure use as import', async () => {
        const doc = await createDocument(
            '<?php\n\n$fn = function () use ($var) {};'
        );
        const { useStatements } = parser.parse(doc);
        assert.strictEqual(useStatements.length, 0);
    });

    test('getImportedClassNames should return short names', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User;\nuse Illuminate\\Http\\Request;\n\nclass Foo {}'
        );
        const names = parser.getImportedClassNames(doc);
        assert.deepStrictEqual(names, ['User', 'Request']);
    });

    test('getImportedClassNames should return alias names', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User as AppUser;\n\nclass Foo {}'
        );
        const names = parser.getImportedClassNames(doc);
        assert.deepStrictEqual(names, ['AppUser']);
    });

    test('getInsertPosition should compute correct position', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App;\n\nuse Foo\\Bar;\n\nclass Baz {}'
        );
        const { declarationLines } = parser.parse(doc);
        const pos = parser.getInsertPosition(declarationLines);
        assert.strictEqual(pos.line, 5);
    });

    test('should parse inline <?php namespace syntax with leading whitespace', async () => {
        const doc = await createDocument(
            '  <?php namespace App\\Controllers;\n\nclass Foo {}'
        );
        const { declarationLines } = parser.parse(doc);
        // With leading whitespace, startsWith('<?php') is false,
        // so the else-if regex matches the <?php namespace pattern
        assert.strictEqual(declarationLines.namespace, 1);
    });

    test('should set phpTag but not namespace for <?php namespace on same line', async () => {
        const doc = await createDocument(
            '<?php namespace App\\Controllers;\n\nclass Foo {}'
        );
        const { declarationLines } = parser.parse(doc);
        // startsWith('<?php') fires first, so phpTag is set but namespace is not
        assert.strictEqual(declarationLines.phpTag, 1);
        assert.strictEqual(declarationLines.namespace, null);
    });

    test('should return null for malformed use statement without semicolon', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User\n\nclass Foo {}'
        );
        const { useStatements } = parser.parse(doc);
        assert.strictEqual(useStatements.length, 0);
    });

    test('should break early when all declarations are found', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App;\n\nuse Foo\\Bar;\n\nclass Baz {}\n\nuse Should\\Not\\Parse;'
        );
        const { useStatements } = parser.parse(doc);
        // The early-exit should prevent parsing use statements after the class
        assert.strictEqual(useStatements.length, 1);
        assert.strictEqual(useStatements[0].className, 'Bar');
    });

    test('getImportedClassNames should stop at class declaration', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\User;\n\nclass Foo {\n    // use App\\Fake\\Thing;\n}'
        );
        const names = parser.getImportedClassNames(doc);
        assert.deepStrictEqual(names, ['User']);
    });

    test('should detect final class declarations', async () => {
        const doc = await createDocument(
            '<?php\n\nfinal class UserService {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.classDeclaration, 3);
    });

    test('should parse declare statement line', async () => {
        const doc = await createDocument(
            '<?php\ndeclare(strict_types=1);\n\nnamespace App;\n\nclass Foo {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.declare, 2);
        assert.strictEqual(declarationLines.namespace, 4);
    });

    test('should parse declare with spaces', async () => {
        const doc = await createDocument(
            '<?php\n  declare( strict_types = 1 );\n\nclass Foo {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.declare, 2);
    });

    test('should return null declare when no declare statement exists', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App;\n\nclass Foo {}'
        );
        const { declarationLines } = parser.parse(doc);
        assert.strictEqual(declarationLines.declare, null);
    });

    test('should parse single-line grouped use statement', async () => {
        const doc = await createDocument(
            '<?php\n\nnamespace App;\n\nuse App\\Models\\{User, Post};\n\nclass Foo {}'
        );
        const { useStatements, declarationLines } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 2);
        assert.strictEqual(useStatements[0].className, 'User');
        assert.strictEqual(useStatements[0].fqcn, 'App\\Models\\User');
        assert.strictEqual(useStatements[1].className, 'Post');
        assert.strictEqual(useStatements[1].fqcn, 'App\\Models\\Post');
        assert.strictEqual(declarationLines.firstUseStatement, 5);
        assert.strictEqual(declarationLines.lastUseStatement, 5);
    });

    test('should parse grouped use statement with single class', async () => {
        const doc = await createDocument(
            '<?php\n\nuse Example1\\Example2\\Models\\{SomeClass};\n\nclass Foo {}'
        );
        const { useStatements } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 1);
        assert.strictEqual(useStatements[0].className, 'SomeClass');
        assert.strictEqual(useStatements[0].fqcn, 'Example1\\Example2\\Models\\SomeClass');
    });

    test('should parse grouped use statement with alias', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{User as AppUser, Post};\n\nclass Foo {}'
        );
        const { useStatements } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 2);
        assert.strictEqual(useStatements[0].className, 'AppUser');
        assert.strictEqual(useStatements[0].alias, 'AppUser');
        assert.strictEqual(useStatements[0].fqcn, 'App\\Models\\User');
        assert.strictEqual(useStatements[1].className, 'Post');
        assert.strictEqual(useStatements[1].alias, null);
    });

    test('should parse grouped use statement with nested namespaces', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\{Models\\User, Http\\Request};\n\nclass Foo {}'
        );
        const { useStatements } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 2);
        assert.strictEqual(useStatements[0].className, 'User');
        assert.strictEqual(useStatements[0].fqcn, 'App\\Models\\User');
        assert.strictEqual(useStatements[1].className, 'Request');
        assert.strictEqual(useStatements[1].fqcn, 'App\\Http\\Request');
    });

    test('should parse multi-line grouped use statement', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{\n    User,\n    Post,\n};\n\nclass Foo {}'
        );
        const { useStatements, declarationLines } = parser.parse(doc);

        assert.strictEqual(useStatements.length, 2);
        assert.strictEqual(useStatements[0].className, 'User');
        assert.strictEqual(useStatements[0].fqcn, 'App\\Models\\User');
        assert.strictEqual(useStatements[1].className, 'Post');
        assert.strictEqual(useStatements[1].fqcn, 'App\\Models\\Post');
        assert.strictEqual(declarationLines.firstUseStatement, 3);
        assert.strictEqual(declarationLines.lastUseStatement, 6);
    });

    test('getImportedClassNames should handle grouped use statements', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{User, Post};\n\nclass Foo {}'
        );
        const names = parser.getImportedClassNames(doc);
        assert.deepStrictEqual(names, ['User', 'Post']);
    });

    test('getImportedClassNames should handle multi-line grouped use statements', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{\n    User,\n    Post,\n};\n\nclass Foo {}'
        );
        const names = parser.getImportedClassNames(doc);
        assert.deepStrictEqual(names, ['User', 'Post']);
    });

    test('getImportedClassNames should handle grouped use with alias', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{User as AppUser, Post};\n\nclass Foo {}'
        );
        const names = parser.getImportedClassNames(doc);
        assert.deepStrictEqual(names, ['AppUser', 'Post']);
    });

    test('should throw when class in grouped import is already imported', async () => {
        const doc = await createDocument(
            '<?php\n\nuse App\\Models\\{User, Post};\n\nclass Foo {}'
        );
        assert.throws(
            () => parser.parse(doc, 'App\\Models\\User'),
            /already imported/
        );
    });
});
