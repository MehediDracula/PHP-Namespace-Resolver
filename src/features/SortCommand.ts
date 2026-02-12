import { SortManager } from '../core/SortManager';
import { requireActiveEditor } from '../utils/editor';
import { showStatusMessage } from '../utils/statusBar';

export class SortCommand {
    constructor(private sortManager: SortManager) {}

    execute(): void {
        try {
            const editor = requireActiveEditor();
            this.sortManager.sort(editor);
            showStatusMessage('$(check) Imports are sorted.');
        } catch (error: any) {
            showStatusMessage(error.message);
        }
    }
}
