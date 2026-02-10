import { SortManager } from '../core/SortManager';
import { requireActiveEditor } from '../utils/editor';
import { showMessage, showError } from '../utils/messages';

/**
 * Handles the Sort Imports command.
 */
export class SortCommand {
    constructor(private sortManager: SortManager) {}

    execute(): void {
        try {
            const editor = requireActiveEditor();
            this.sortManager.sort(editor);
            showMessage('$(check)  Imports are sorted.');
        } catch (error: any) {
            showError(error.message);
        }
    }
}
