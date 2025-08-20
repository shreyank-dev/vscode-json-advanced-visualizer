import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { TreeViewComponent } from '../tree-view/tree-view.component';

/**
 * The TableViewComponent is responsible for rendering JSON data that is structured
 * as an array of objects in a dynamic, paginated, and sortable table.
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
  /** The raw data (array of objects) passed in from the parent component. */
  @Input() tableData: any[] = [];

  /** An array of strings representing the dynamic column headers for the table. */
  public columns: string[] = [];

  /** A flag to control the visibility of the nested data dialog. */
  public displayDialog: boolean = false;

  /** The data for the specific cell that was clicked to be shown in the dialog. */
  public selectedCellData: any = null;

  /**
   * Angular lifecycle hook that fires when an @Input property changes.
   * This is the entry point for generating the table's structure.
   * @param changes An object containing the changed input properties.
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['tableData'] && this.tableData?.length > 0) {
      // Create a union of all keys from all objects for column headers
      const columnSet = new Set<string>();
      this.tableData.forEach((row) => {
        Object.keys(row).forEach((key) => columnSet.add(key));
      });
      this.columns = Array.from(columnSet);
    }
  }

  /**
   * A helper function to check if a value is a non-null object or array.
   * This is used in the template to decide whether to show a value directly or a "View" button.
   * @param value The value to check.
   */
  public isObject(value: any): boolean {
    return value !== null && typeof value === 'object';
  }

  /**
   * Sets the data for the dialog and makes it visible.
   * Called when a user clicks the "View" button in a table cell.
   * @param data The nested object or array to display.
   */
  public showDialog(data: any) {
    this.selectedCellData = data;
    this.displayDialog = true;
  }
}
