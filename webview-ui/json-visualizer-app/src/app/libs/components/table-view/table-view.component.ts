import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { TreeViewComponent } from '../tree-view/tree-view.component';
import { VscodeApiService } from '../../services/vscode-api.service';

/**
 * The TableViewComponent renders tabular raw datasets as dynamic, paginated,
 * and column-sortable matrices inside the VS Code visualizer panel context.
 */
@Component({
  selector: 'app-table-view',
  imports: [
    CommonModule,
    TableModule,
    DialogModule,
    ButtonModule,
    TooltipModule,
    TreeViewComponent,
  ],
  templateUrl: './table-view.component.html',
  styleUrl: './table-view.component.scss',
})
export class TableViewComponent implements OnChanges {
  /** Bridge service channel for interacting with the main extension host panel */
  private readonly vscodeApiService = inject(VscodeApiService);

  /** Array of structural object rows passed from parent view controller nodes */
  @Input() tableData: any[] = [];

  public columns: string[] = [];
  public displayDialog: boolean = false;
  public selectedCellData: any = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tableData'] && this.tableData?.length > 0) {
      const columnSet = new Set<string>();
      this.tableData.forEach((row) => {
        if (row && typeof row === 'object') {
          Object.keys(row).forEach((key) => columnSet.add(key));
        }
      });
      this.columns = Array.from(columnSet);
    }
  }

  public isObject(value: any): boolean {
    return value !== null && typeof value === 'object';
  }

  /**
   * Safe formatter wrapper to display custom text fallbacks inside clipped table containers.
   */
  public formatCellDisplay(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return '';
    return String(value);
  }

  /**
   * Extracts untruncated primitive cell data payloads and saves them cleanly to clipboard.
   */
  public copyRawCellValue(value: any, event: MouseEvent) {
    event.stopPropagation();
    if (value === undefined) return;

    const textToCopy = String(value);

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        this.vscodeApiService.postMessage({
          command: 'showInfo',
          text: 'Cell Data copied to Clipboard!',
        });
      })
      .catch((err) => {
        this.vscodeApiService.postMessage({
          command: 'showError',
          text: 'Failed to copy data.',
        });
        console.error(
          'Failed to copy tabular element string text contents:',
          err,
        );
      });
  }

  public showDialog(data: any) {
    this.selectedCellData = data;
    this.displayDialog = true;
  }
}
