import { SortManager } from '../core/SortManager';
import { requireActiveEditor } from '../utils/editor';
import { showStatusMessage } from '../utils/statusBar';

export class SortCommand {
    constructor(private sortManager: SortManager) {}

    async execute(): Promise<void> {
        try {
            const editor = requireActiveEditor();
            await this.sortManager.sort(editor);
            showStatusMessage('$(check) Imports are sorted.');
        } catch (error: any) {
            showStatusMessage(error.message);
        }
    }
}
