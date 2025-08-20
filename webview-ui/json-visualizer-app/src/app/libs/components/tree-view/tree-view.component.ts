import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

import { VscodeApiService } from './../../services/vscode-api.service';

// Constants for string literals
const JSON_STYLE_CLASSES = {
  NULL: 'json-null',
  STRING: 'json-string',
  NUMBER: 'json-number',
  BOOLEAN: 'json-boolean',
  ARRAY: 'json-array',
  OBJECT: 'json-object',
  DEFAULT: 'json-default',
};

type CopyType = 'Key' | 'Value' | 'Path';

/**
 * The TreeViewComponent is responsible for rendering JSON data in an interactive,
 * collapsible tree structure. It provides features like syntax highlighting,
 * item counts, hover-to-copy actions, and JSONPath display.
 */
@Component({
  selector: 'app-tree-view',
  imports: [CommonModule, TreeModule, TooltipModule],
  templateUrl: './tree-view.component.html',
  styleUrl: './tree-view.component.scss',
})
export class TreeViewComponent implements OnChanges {
  /** Injected service for communicating with the VS Code extension host. */
  vscodeApiService = inject(VscodeApiService);

  /** The raw JSON object or array passed in from the parent component. */
  @Input() jsonData: any;

  /** The transformed data in the format required by the PrimeNG p-tree component. */
  public treeData: TreeNode[] = [];

  /** The JSONPath of the currently selected node in the tree. */
  public selectedNodePath: string | null = null;

  /**
   * Angular lifecycle hook that fires when an @Input property changes.
   * This is the entry point for transforming new JSON data.
   * @param changes An object containing the changed input properties.
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['jsonData'] && changes['jsonData'].currentValue) {
      this.treeData = this.transformJsonToTreeNodes(this.jsonData);
    }
  }

  /**
   * Event handler called by the p-tree component when a node is selected.
   * @param event The selection event object from PrimeNG.
   */
  public onNodeSelect(event: { node: TreeNode }) {
    if (event.node && event.node.data) {
      this.selectedNodePath = event.node.data.path;
    }
  }

  /**
   * Copies the given value to the user's clipboard and sends a notification
   * back to the VS Code extension host.
   * @param value The data to be copied.
   * @param type A user-friendly string describing the type of data being copied.
   * @param event The mouse event, used to stop propagation.
   */
  public copyToClipboard(value: any, type: CopyType, event: MouseEvent) {
    event.stopPropagation();

    const textToCopy =
      typeof value === 'object' && value !== null
        ? JSON.stringify(value, null, 2)
        : String(value);

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        this.vscodeApiService.postMessage({
          command: 'showInfo',
          text: `${type} copied to clipboard`,
        });
      })
      .catch((err) => {
        this.vscodeApiService.postMessage({
          command: 'showError',
          text: `Failed to copy ${type}`,
        });
        console.error(`Failed to copy ${type} to clipboard:`, err);
      });
  }

  /**
   * Recursively transforms a JSON object or array into the TreeNode array structure.
   * This is the entry point for the transformation logic.
   * @param data The JSON object or array to transform.
   * @param path The current JSONPath being built.
   * @returns An array of TreeNode objects.
   */
  private transformJsonToTreeNodes(data: any, path: string = '$'): TreeNode[] {
    if (data === null || typeof data !== 'object') {
      return [];
    }
    if (Array.isArray(data)) {
      return data.map((value, index) =>
        this.createNode(index.toString(), value, `${path}[${index}]`)
      );
    }
    return Object.entries(data).map(([key, value]) =>
      this.createNode(key, value, `${path}.${key}`)
    );
  }

  /**
   * A helper function to create a single, fully-formed TreeNode.
   * @param key The JSON key or array index for the node.
   * @param value The JSON value for the node.
   * @param path The full JSONPath to this node.
   * @returns A TreeNode object.
   */
  private createNode(key: string, value: any, path: string): TreeNode {
    const node: TreeNode = {
      label: key,
      styleClass: this.getValueType(value),
      expanded: true,
      data: { key, value, path },
    };

    const isObject = value !== null && typeof value === 'object';
    if (isObject) {
      node.children = this.transformJsonToTreeNodes(value, path);
      const count = Object.keys(value).length;
      const suffix = Array.isArray(value) ? `[${count}]` : `{${count}}`;
      node.label = `${key}: ${suffix}`;
      node.icon = Array.isArray(value)
        ? 'pi pi-fw pi-list'
        : 'pi pi-fw pi-folder';
    } else {
      const displayValue =
        typeof value === 'string' ? `"${value}"` : String(value);
      node.label = `${key}: ${displayValue}`;
      node.icon = 'pi pi-fw pi-file';
    }
    return node;
  }

  /**
   * Returns a CSS class name based on the data type of the value.
   * @param value The value to check.
   * @returns A string representing the CSS class from our constants.
   */
  private getValueType(value: any): string {
    if (value === null) return JSON_STYLE_CLASSES.NULL;
    switch (typeof value) {
      case 'string':
        return JSON_STYLE_CLASSES.STRING;
      case 'number':
        return JSON_STYLE_CLASSES.NUMBER;
      case 'boolean':
        return JSON_STYLE_CLASSES.BOOLEAN;
      case 'object':
        return Array.isArray(value)
          ? JSON_STYLE_CLASSES.ARRAY
          : JSON_STYLE_CLASSES.OBJECT;
      default:
        return JSON_STYLE_CLASSES.DEFAULT;
    }
  }
}
