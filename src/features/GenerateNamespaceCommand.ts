import { NamespaceGenerator } from '../core/NamespaceGenerator';
import { requireActiveEditor } from '../utils/editor';
import { showStatusMessage } from '../utils/statusBar';

export class GenerateNamespaceCommand {
    constructor(private generator: NamespaceGenerator) {}

    async execute(): Promise<void> {
        try {
            const editor = requireActiveEditor();
            await this.generator.generate(editor);
        } catch (error: any) {
            showStatusMessage(error.message);
        }
    }
}
