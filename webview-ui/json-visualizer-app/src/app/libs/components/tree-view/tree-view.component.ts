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

  /** Flag to check whether the component is opened in a dialog or not */
  @Input() dialogMode: boolean = false;

  /** The transformed data in the format required by the PrimeNG p-tree component. */
  public treeData: TreeNode[] = [];

  /** The JSONPath of the currently selected node in the tree. */
  public selectedNodePath: string | null = null;

  /** Maximum number of nodes allowed to expand instantly without warning the user. */
  private readonly MAX_EXPAND_THRESHOLD = 5000;
  /** Tracks the computed total density of the active JSON document. */
  public actualNodeCount = 0;
  /** Tracks the number of visible nodes currently matching the search filter. */
  public filteredNodeCount = 0;

  /** Pristine cache of the fully transformed tree structure used for fast resetting. */
  private masterTreeData: TreeNode[] = [];

  /** Debounce timer reference to limit CPU cycles during fast typing. */
  private searchDebounceTimer: any;
  /** Holds the active, sanitized filter string. */
  private currentSearchQuery = '';

  /**
   * Angular lifecycle hook that fires when an @Input property changes.
   * This is the entry point for transforming new JSON data.
   * @param changes An object containing the changed input properties.
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['jsonData'] && changes['jsonData'].currentValue) {
      // Reset our metrics counter before generating a fresh layout tree
      this.actualNodeCount = 0;
      // 1. Generate the initial comprehensive data model
      const generatedTree = this.transformJsonToTreeNodes(this.jsonData);

      // 2. Cache a deep copy reference for our filter operations
      this.masterTreeData = generatedTree;
      this.treeData = generatedTree;
    }
  }

  /** Evaluates fallback limits and triggers global tree node expansion. */
  public expandAll() {
    if (this.currentSearchQuery.length && this.filteredNodeCount === 0) {
      return;
    }

    if (this.actualNodeCount > this.MAX_EXPAND_THRESHOLD) {
      this.vscodeApiService.postMessage({
        command: 'showInfo',
        text: `Large dataset warning: Processing ${this.actualNodeCount} nodes may cause a brief layout lag.`,
      });
    }

    this.toggleAllNodes(true);
  }

  /** Collapses all nodes in the workspace instantly. */
  public collapseAll() {
    this.toggleAllNodes(false);
  }

  /**
   * High performance recursive controller loop.
   * Updates array references cleanly to notify PrimeNG's virtual scroller engine.
   */
  private toggleAllNodes(expand: boolean) {
    const updatedTree = [...this.treeData];
    updatedTree.forEach((node) => this.toggleNodeRecursive(node, expand));
    // Trigger reference assignment mutation for fast change detection
    this.treeData = updatedTree;
  }

  /** Mutates structural node metadata recursively down through nested child scopes. */
  private toggleNodeRecursive(node: TreeNode, isExpand: boolean) {
    if (node.children && node.children.length > 0) {
      node.expanded = isExpand;
      node.children.forEach((child) =>
        this.toggleNodeRecursive(child, isExpand),
      );
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
   * Set the scroll height for tree view based on whether the tree view is opened in a dialog or not
   */
  get scrollHeight() {
    // Adjusted slightly to accommodate the new 34px toolbar header space cleanly
    return this.dialogMode ? 'calc(60vh - 11.0rem)' : 'calc(100vh - 11.0rem)';
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
        this.createNode(index.toString(), value, `${path}[${index}]`),
      );
    }
    return Object.entries(data).map(([key, value]) =>
      this.createNode(key, value, `${path}.${key}`),
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
    // Increment total document elements found
    this.actualNodeCount++;

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
   * Captures incoming input events and applies an optimized debouncing filter.
   */
  public onSearch(query: string) {
    clearTimeout(this.searchDebounceTimer);

    // Wait 500ms after the user stops typing before manipulating the json dataset
    this.searchDebounceTimer = setTimeout(() => {
      this.currentSearchQuery = query.trim().toLowerCase();

      if (!this.currentSearchQuery) {
        this.treeData = this.masterTreeData;
        this.filteredNodeCount = 0;
        return;
      }

      const filteredResult = this.filterTree(
        this.masterTreeData,
        this.currentSearchQuery,
      );
      this.filteredNodeCount = this.countNodes(filteredResult);
      this.treeData = filteredResult;
    }, 500);
  }

  /**
   * High-performance helper to instantly calculate node density
   * inside a filtered TreeNode array subset.
   */
  private countNodes(nodes: TreeNode[]): number {
    let count = 0;
    const walk = (nodeList: TreeNode[]) => {
      for (const node of nodeList) {
        count++;
        if (node.children && node.children.length > 0) {
          walk(node.children);
        }
      }
    };
    walk(nodes);
    return count;
  }

  /**
   * High performance structural filtering algorithm.
   * Recursively prunes nodes that do not match the query while preserving matching hierarchies.
   */
  private filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    return nodes
      .map((node) => {
        // Create a shallow copy of the node to avoid mutating the master data cache directly
        const clonedNode = { ...node };

        // If this node has children, filter them recursively first
        if (clonedNode.children && clonedNode.children.length > 0) {
          const matchingChildren = this.filterTree(clonedNode.children, query);
          clonedNode.children = matchingChildren;

          // Strategy: If any child matched, this parent must stay visible and be auto-expanded
          if (matchingChildren.length > 0) {
            clonedNode.expanded = true;
            return clonedNode;
          }
        }

        // Check if the node's label or data matches our filter target
        const labelText = clonedNode.label?.toLowerCase() || '';
        const valueText =
          clonedNode.data?.value !== undefined
            ? String(clonedNode.data.value).toLowerCase()
            : '';

        if (labelText.includes(query) || valueText.includes(query)) {
          return clonedNode;
        }

        return null;
      })
      .filter((node): node is TreeNode => node !== null); // Strip out pruned branches cleanly
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
