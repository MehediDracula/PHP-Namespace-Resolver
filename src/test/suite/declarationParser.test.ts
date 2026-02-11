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
});
