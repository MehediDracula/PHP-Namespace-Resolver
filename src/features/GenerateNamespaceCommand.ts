import { NamespaceGenerator } from '../core/NamespaceGenerator';
import { requireActiveEditor } from '../utils/editor';
import { showError } from '../utils/messages';

/**
 * Handles the Generate Namespace command.
 */
export class GenerateNamespaceCommand {
    constructor(private generator: NamespaceGenerator) {}

    async execute(): Promise<void> {
        try {
            const editor = requireActiveEditor();
            await this.generator.generate(editor);
        } catch (error: any) {
            showError(error.message);
        }
    }
}
