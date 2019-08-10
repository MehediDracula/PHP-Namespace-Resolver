import { Parser } from './Parser';
import { ClassInfo } from "./ClassInfo";
import { ParsedResult } from "./ParsedResult";

import builtInClasses from './classes';
import { naturalSort } from 'node-natural-sort';
import { window, workspace, TextEditor, Range, Position, Selection, TextEditorDecorationType } from 'vscode';


export class Resolver {
    private decorationTypeForNotImported: TextEditorDecorationType;
    private decorationTypeForNotUsed: TextEditorDecorationType;
    constructor() {
        this.decorationTypeForNotImported = window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,155,0, 0.5)',
            light: {
                borderColor: 'darkblue'
            },
            dark: {
                borderColor: 'lightblue'
            }
        });

        this.decorationTypeForNotUsed = window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255,55,55, 0.5)',
            light: {
                borderColor: 'darkblue'
            },
            dark: {
                borderColor: 'lightblue'
            }
        });
    }

    async importCommand(selection: any) {
        let resolving = this.resolving(selection);

        if (resolving === undefined) {
            return this.showErrorMessage(`$(issue-opened)  No class is selected.`);
        }

        let fqcn;
        let replaceClassAfterImport = false;

        if (/\\/.test(resolving)) {
            fqcn = resolving;
            replaceClassAfterImport = true;
        } else {
            let files = await this.findFiles(resolving);
            let namespaces = await this.findNamespaces(resolving, files);

            fqcn = await this.pickClass(namespaces);
        }

        this.importClass(selection, fqcn, replaceClassAfterImport);
    }

    async importAll() {
        let text = this.activeEditor().document.getText();
        var result = this.parseText(text);

        let notImported = this.getNotImported(result);

        for (let phpClass of notImported) {
            await this.importCommand(phpClass.name); 
        }
    }

    parseText(text) {
        return (new Parser(text)).parse();;
    }

    getNotImported(result: ParsedResult): ClassInfo[] {
        return result.classesUsed.filter(function (phpClass) {
            return !result.useStatements.some(useStatement => {
                return useStatement.hasSameBaseName(phpClass);
            });
        });
    }

    async highlightNotImported() {
        let text = this.activeEditor().document.getText();

        var result = this.parseText(text);

        let notImported = this.getNotImported(result);

        // Highlight diff
        const decorationOptions = notImported.map(classObject => {
            return {
                range: new Range(
                    classObject.startPosition,
                    classObject.endPosition
                ),
                hoverMessage: `Class '${classObject.name}' is not imported.`,
            };
        });



        this.activeEditor().setDecorations(this.decorationTypeForNotImported, decorationOptions);
    }

    async highlightNotUsed() {
        const text = this.activeEditor().document.getText();

        var parsed = this.parseText(text);

        let notUsed = parsed.useStatements.filter(function (useStatement) {
            return !parsed.classesUsed.some(phpClass => {
                return useStatement.hasSameBaseName(phpClass);
            });
        });
        
        const decorationOptions = notUsed.map(row => {
            return {
                range: new Range(row.startPosition, row.endPosition),
                hoverMessage: `Class '${row.name}' is not used.`,
            };
        });


        this.activeEditor().setDecorations(this.decorationTypeForNotUsed, decorationOptions);
    }

    importClass(selection, fqcn, replaceClassAfterImport = false) {
        let useStatements, declarationLines;

        try {
            [useStatements, declarationLines] = this.getDeclarations(fqcn);
        } catch (error) {
            return this.showErrorMessage(error.message);
        }

        let classBaseName = fqcn.match(/(\w+)/g).pop();

        if (this.hasConflict(useStatements, classBaseName)) {
            this.insertAsAlias(selection, fqcn, useStatements, declarationLines);
        } else if (replaceClassAfterImport) {
            this.importAndReplaceSelectedClass(selection, classBaseName, fqcn, declarationLines);
        } else {
            this.insert(fqcn, declarationLines);
        }
    }

    async insert(fqcn, declarationLines, alias = null) {
        let [prepend, append, insertLine] = this.getInsertLine(declarationLines);

        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                new Position((insertLine), 0),
                (`${prepend}use ${fqcn}`) + (alias !== null ? ` as ${alias}` : '') + (`;${append}`)
            );
        });

        if (this.config('autoSort')) {
            this.sortImports();
        }

        this.showMessage('$(check)  The class is imported.');
    }

    async insertAsAlias(selection, fqcn, useStatements, declarationLines) {
        let alias = await window.showInputBox({
            placeHolder: 'Enter an alias or leave it empty to replace'
        });

        if (alias === undefined) {
            return;
        }

        if (this.hasConflict(useStatements, alias)) {
            this.showErrorMessage(`$(issue-opened)  This alias is already in use.`);

            this.insertAsAlias(selection, fqcn, useStatements, declarationLines)
        } else if (alias !== '') {
            this.importAndReplaceSelectedClass(selection, alias, fqcn, declarationLines, alias);
        } else if (alias === '') {
            this.replaceUseStatement(fqcn, useStatements);
        }
    }

    async replaceUseStatement(fqcn, useStatements) {
        let useStatement = useStatements.find(use => {
            let className = use.text.match(/(\w+)?;/).pop();

            return fqcn.endsWith(className);
        });

        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                new Range(useStatement.line, 0, useStatement.line, useStatement.text.length),
                `use ${fqcn};`
            );
        });

        if (this.config('autoSort')) {
            this.sortImports();
        }
    }

    async replaceNamespaceStatement(namespace, line) {
        let realLine = line - 1;
        let text = this.activeEditor().document.lineAt(realLine).text;
        let newNs = text.replace(/namespace (.+)/, namespace);

        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                new Range(realLine, 0, realLine, text.length),
                newNs.trim()
            );
        });
    }

    async importAndReplaceSelectedClass(selection, replacingClassName, fqcn, declarationLines, alias = null) {
        await this.changeSelectedClass(selection, replacingClassName, false);

        this.insert(fqcn, declarationLines, alias);
    }

    async expandCommand(selection) {
        let resolving = this.resolving(selection);

        if (resolving === null) {
            return this.showErrorMessage(`$(issue-opened)  No class is selected.`);
        }

        let files = await this.findFiles(resolving);
        let namespaces = await this.findNamespaces(resolving, files);
        let fqcn = await this.pickClass(namespaces);

        this.changeSelectedClass(selection, fqcn, true);
    }

    async changeSelectedClass(selection, fqcn, prependBackslash = false) {
        await this.activeEditor().edit(textEdit => {
            textEdit.replace(
                this.activeEditor().document.getWordRangeAtPosition(selection.active),
                (prependBackslash && this.config('leadingSeparator') ? '\\' : '') + fqcn
            );
        });

        let newPosition = new Position(selection.active.line, selection.active.character);

        this.activeEditor().selection = new Selection(newPosition, newPosition);
    }

    sortCommand() {
        try {
            this.sortImports();
        } catch (error) {
            return this.showErrorMessage(error.message);
        }

        this.showMessage('$(check)  Imports are sorted.');
    }

    findFiles(resolving) {
        return workspace.findFiles(`**/${resolving}.php`, this.config('exclude') as string);
    }

    findNamespaces(resolving, files) {
        return new Promise((resolve, reject) => {
            let textDocuments = this.getTextDocuments(files, resolving);

            Promise.all(textDocuments).then(docs => {
                let parsedNamespaces = this.parseNamespaces(docs, resolving);

                if (parsedNamespaces.length === 0) {
                    return this.showErrorMessage(`$(circle-slash)  The class '${resolving}' is not found.`);
                }

                resolve(parsedNamespaces);
            });
        });
    }

    pickClass(namespaces) {
        return new Promise((resolve, reject) => {
            if (namespaces.length === 1) {
                // Only one namespace found so no need to show picker.
                return resolve(namespaces[0]);
            }

            window.showQuickPick(namespaces).then(picked => {
                if (picked !== undefined) {
                    resolve(picked);
                }
            });
        })
    }

    getTextDocuments(files, resolving) {
        let textDocuments = [];

        for (let i = 0; i < files.length; i++) {
            let fileName = files[i].fsPath.replace(/^.*[\\\/]/, '').split('.')[0];

            if (fileName !== resolving) {
                continue;
            }

            textDocuments.push(workspace.openTextDocument(files[i]));
        }

        return textDocuments;
    }

    parseNamespaces(docs, resolving) {
        let parsedNamespaces = [];

        for (let i = 0; i < docs.length; i++) {
            for (let line = 0; line < docs[i].lineCount; line++) {
                let textLine = docs[i].lineAt(line).text;

                if (textLine.startsWith('namespace ') || textLine.startsWith('<?php namespace ')) {
                    let namespace = textLine.match(/^(namespace|(<\?php namespace))\s+(.+)?;/).pop();
                    let fqcn = `${namespace}\\${resolving}`;

                    if (! parsedNamespaces.includes(fqcn)) {
                        parsedNamespaces.push(fqcn);
                        break;
                    }
                }
            }
        }

        // If selected text is a built-in php class add that at the beginning.
        if (builtInClasses.includes(resolving)) {
            parsedNamespaces.unshift(resolving);
        }

        // If namespace can't be parsed but there is a file with the same
        // name of selected text then assuming it's a global class and
        // add that in the parsedNamespaces array as a global class.
        if (parsedNamespaces.length === 0 && docs.length > 0) {
            parsedNamespaces.push(resolving);
        }

        return parsedNamespaces;
    }

    sortImports() {
        let [useStatements,] = this.getDeclarations();

        if ((useStatements as any[]).length <= 1) {
            throw new Error('$(issue-opened)  Nothing to sort.');
        }

        let sortFunction = (a, b) => {
            if (this.config('sortAlphabetically')) {
                if (a.text.toLowerCase() < b.text.toLowerCase()) return -1;
                if (a.text.toLowerCase() > b.text.toLowerCase()) return 1;
                return 0;
            } else {
                if (a.text.length == b.text.length) {
                    if (a.text.toLowerCase() < b.text.toLowerCase()) return -1;
                    if (a.text.toLowerCase() > b.text.toLowerCase()) return 1;
                }

                return a.text.length - b.text.length;
            }
        }

        if (this.config('sortNatural')) {
            let natsort = naturalSort({
                caseSensitive: true,
                order: this.config('sortAlphabetically') ? 'ASC' : 'DESC'
            });

            sortFunction = (a, b) => {
                return natsort(a.text, b.text);
            };
        }

        let sorted = (useStatements as any[]).slice().sort(sortFunction);

        this.activeEditor().edit(textEdit => {
            for (let i = 0; i < sorted.length; i++) {
                textEdit.replace(
                    new Range(useStatements[i].line, 0, useStatements[i].line, useStatements[i].text.length),
                    sorted[i].text
                );
            }
        });
    }

    activeEditor() {
        return window.activeTextEditor as TextEditor;
    }

    hasConflict(useStatements, resolving) {
        for (let i = 0; i < useStatements.length; i++) {
            if (useStatements[i].text.match(/(\w+)?;/).pop() === resolving) {
                return true;
            }
        }

        return false;
    }

    getDeclarations(pickedClass = null) {
        let useStatements = [];
        let declarationLines = {
            PHPTag: 0,
            namespace: null,
            useStatement: null,
            class: null
        };

        for (let line = 0; line < this.activeEditor().document.lineCount; line++) {
            let text = this.activeEditor().document.lineAt(line).text;

            if (pickedClass !== null && text === `use ${pickedClass};`) {
                throw new Error('$(issue-opened)  The class is already imported.');
            }

            // break if all declarations were found.
            if (declarationLines.PHPTag && declarationLines.namespace &&
                declarationLines.useStatement && declarationLines.class) {
                break;
            }

            if (text.startsWith('<?php')) {
                declarationLines.PHPTag = line + 1;
            } else if (text.startsWith('namespace ') || text.startsWith('<?php namespace')) {
                declarationLines.namespace = line + 1;
            } else if (text.startsWith('use ')) {
                useStatements.push({ text, line });
                declarationLines.useStatement = line + 1;
            } else if (/(class|trait|interface)\s+\w+/.test(text)) {
                declarationLines.class = line + 1;
            }
        }

        return [useStatements, declarationLines];
    }

    getInsertLine(declarationLines) {
        let prepend = declarationLines.PHPTag === 0 ? '' : '\n';
        let append = '\n';
        let insertLine = declarationLines.PHPTag;

        if (prepend === '' && declarationLines.namespace !== null) {
            prepend = '\n';
        }

        if (declarationLines.useStatement !== null) {
            prepend = '';
            insertLine = declarationLines.useStatement;
        } else if (declarationLines.namespace !== null) {
            insertLine = declarationLines.namespace;
        }

        if (declarationLines.class !== null &&
            ((declarationLines.class - declarationLines.useStatement) <= 1 ||
            (declarationLines.class - declarationLines.namespace) <= 1 ||
            (declarationLines.class - declarationLines.PHPTag) <= 1)
        ) {
            append = '\n\n';
        }

        return [prepend, append, insertLine];
    }

    resolving(selection) {
        if ((typeof selection) == 'string') {
            return selection;
        }

        let wordRange = this.activeEditor().document.getWordRangeAtPosition(selection.active);

        if (wordRange === undefined) {
            return;
        }

        return this.activeEditor().document.getText(wordRange);
    }

    config(key) {
        return workspace.getConfiguration('namespaceResolver').get(key);
    }

    showMessage(message, error = false) {
        if (this.config('showMessageOnStatusBar')) {
            return window.setStatusBarMessage(message, 3000);
        }

        message = message.replace(/\$\(.+?\)\s\s/, '');

        if (error) {
            window.showErrorMessage(message);
        } else {
            window.showInformationMessage(message);
        }
    }

    showErrorMessage(message) {
        this.showMessage(message, true);
    }

    async generateNamespace() {
        let currentFile = this.activeEditor().document.uri.path;
        let currentPath = currentFile.substr(0, currentFile.lastIndexOf('/'));
        let composerFile = await workspace.findFiles('composer.json');

        if (! composerFile.length) {
            return this.showErrorMessage('No composer.json file found, automatic namespace generation failed');
        }

        const path = composerFile.pop().path;

        workspace.openTextDocument(path).then((document) => {
            let composerJson = JSON.parse(document.getText());
            let psr4 = (composerJson.autoload || {})['psr-4'];

            if (psr4 === undefined) {
                return this.showErrorMessage('No psr-4 key in composer.json autoload object, automatic namespace generation failed');
            }

            let devPsr4 = (composerJson['autoload-dev'] || {})['psr-4'];

            if (devPsr4 !== undefined) {
                psr4 = {...psr4, ...devPsr4};
            }

            let namespaceBase = Object.keys(psr4).filter(function (namespaceBase) {
                return currentPath.split(psr4[namespaceBase])[1];
            }).concat(Object.keys(psr4))[0];

            let baseDir = psr4[namespaceBase];

            namespaceBase = namespaceBase.replace(/\\$/, '');

            let namespaceList = currentPath.split(baseDir);
            let namespace: string = null;
            if (namespaceList[1]) {
                namespace = namespaceList[1]
                namespace = namespace.replace(/\//g, '\\');
                namespace = namespace.replace(/^\\/, '');
                namespace = namespaceBase + '\\' + namespace;
            } else {
                namespace = namespaceBase;
            }

            namespace = 'namespace ' + namespace + ';' + "\n"

            let declarationLines;

            try {
                [, declarationLines] = this.getDeclarations();
            } catch (error) {
                return this.showErrorMessage(error.message);
            }

            if (declarationLines.namespace !== null) {
                this.replaceNamespaceStatement(namespace, declarationLines.namespace);
            } else {
                this.activeEditor().edit(textEdit => {
                    textEdit.insert(new Position(1, 0), namespace);
                });
            }
        });
    }
}
