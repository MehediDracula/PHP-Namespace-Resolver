import { Position } from 'vscode';
import { Location } from './Location';
export class ClassInfo {
    public name: string;
    public location: Location;
    constructor(parsedClassObject: any) {
        this.name = parsedClassObject.name;
        this.location = parsedClassObject.loc;
    }
    get startPosition(): Position {
        return new Position(this.location.start.line - 1, this.location.start.column);
    }
    get endPosition(): Position {
        return new Position(this.location.end.line - 1, this.location.end.column);
    }
    get baseName(): string {
        return this.name.split('\\').pop();
    }
    public hasSameBaseName(classInfo: ClassInfo): boolean {
        return this.baseName === classInfo.baseName;
    }
}
