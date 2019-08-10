import phpParser from 'php-parser';
import { ParsedResult } from './ParsedResult';
import { ClassInfo } from './ClassInfo';


export class Parser {
    private text: string;
    private parser: any;
    public constructor(text: string) {
        this.text = text;

        this.parser = new phpParser({
            parser: {
                extractDoc: false,
                php7: true
            },
            ast: {
                withPositions: true
            }
        });
    }

    public parse(): ParsedResult {
        return this.getClasses();
    }

    private getClasses(): ParsedResult {
        let parsedCode = this.parser.parseCode(this.text, '');

        return {
            useStatements: this.getUseStatements(parsedCode),
            classesUsed: this.getClassesInBody(parsedCode)
        };
    }

    private getClassesInBody(parsedCode: object): ClassInfo[] {
        let allClasses = [];
        this.getBodyElements(parsedCode).forEach(row => {
            if (this.isObject(row)) {
                allClasses.push(...this.getClassesForObject(row));
            }
        });

        allClasses = this.filterOutFunctions(allClasses);

        return allClasses.concat(this.getExtendedClasses(parsedCode));
    }

    private getExtendedClasses(parsedCode: any): ClassInfo[] {
        const classBody = this.getClass(parsedCode);
        if (!classBody) {
            return [];
        }
        const classes = [];

        if ((classBody.extends)) {
            classes.push(new ClassInfo(classBody.extends));
        }

        if (Array.isArray(classBody.implements)) {
            classes.push(...classBody.implements.map(row => {
                return new ClassInfo(row);
            }));
        }
        return classes;
    }

    private filterOutFunctions(classes: ClassInfo[]): ClassInfo[] {
        return classes.filter(row => {
            const charAfterClass = this.text.substring(row.location.end.offset, row.location.end.offset + 1);
            if (charAfterClass === '(') {
                const charsBeforeClass = this.text.substring(row.location.start.offset - 4, row.location.start.offset);
                if (charsBeforeClass !== 'new ') {
                    return false;
                }
            }
            return true;
        });
    }

    private getClassesForObject(row: Record<string, any>): ClassInfo[] {
        const classes: ClassInfo[] = [];

        Object.entries(row).forEach(([key, value]) => {
            if (key === 'kind' && value === 'classreference') {
                classes.push(new ClassInfo(row));
            } else if (Array.isArray(value)) {
                value.forEach(row => {
                    if (this.isObject(row)) {
                        classes.push(...this.getClassesForObject(row));
                    }
                });
            } else if (this.isObject(value)) {
                classes.push(...this.getClassesForObject(value));
            }
        });
        return classes;
    }

    private isObject(value: any) {
        if (value === null) {
            return false;
        }

        return typeof value === 'object';
    }

    private getElements(parsedCode: any): any[] {
        let children = parsedCode.children;

        const nameSpaceObject = children.find(row => {
            return row.kind === 'namespace';
        });
        if (nameSpaceObject) {
            return nameSpaceObject.children;
        }
        return children;
    }

    private getClass(parsedCode: object): any | null {
        const bodyType = this.getElements(parsedCode).find(row => {
            return row.kind === 'class';
        });

        return bodyType;
    }

    private getBodyElements(parsedCode: any): any[] {
        const classObject = this.getClass(parsedCode);

        if (classObject) {
            return classObject.body;
        }

        const returnType = parsedCode.children.find(row => {
            return row.kind === 'return';
        });

        if (returnType) {
            return returnType.expr.items;
        }
        return [];
    }

    private getUseStatements(parsedCode: object): ClassInfo[] {
        return this.getElements(parsedCode).flatMap(child => {
            if (child.kind === 'usegroup') {
                return child.items.map(item => {
                    return new ClassInfo(item);
                });
            }
            return [];
        });
    }

}
