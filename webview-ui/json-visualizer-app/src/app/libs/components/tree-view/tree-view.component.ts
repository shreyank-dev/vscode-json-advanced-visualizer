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

// Style class constants for token highlighting
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
 * The TreeViewComponent renders raw JSON data structures into an interactive,
 * theme-aware collapsible tree structure inside the VS Code webview window space.
 */
@Component({
  selector: 'app-tree-view',
  imports: [CommonModule, TreeModule, TooltipModule],
  templateUrl: './tree-view.component.html',
  styleUrl: './tree-view.component.scss',
})
export class TreeViewComponent implements OnChanges {
  /** Bridge service channel communicating with the parent extension host layer */
  private readonly vscodeApiService = inject(VscodeApiService);

  /** Raw incoming JSON object/array models from text view frames */
  @Input() jsonData: any;

  /** Configures sizing math constraints when displayed inside container popups */
  @Input() dialogMode = false;

  public treeData: TreeNode[] = [];
  public selectedNodePath: string | null = null;
  public actualNodeCount = 0;
  public filteredNodeCount = 0;

  private readonly MAX_EXPAND_THRESHOLD = 5000;
  private masterTreeData: TreeNode[] = [];
  private searchDebounceTimer: any;
  private currentSearchQuery = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['jsonData'] && changes['jsonData'].currentValue) {
      this.actualNodeCount = 0;
      const generatedTree = this.transformJsonToTreeNodes(this.jsonData);

      this.masterTreeData = generatedTree;
      this.treeData = generatedTree;
    }
  }

  get scrollHeight(): string {
    return this.dialogMode ? 'calc(60vh - 11.0rem)' : 'calc(100vh - 11.0rem)';
  }

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

  public collapseAll() {
    this.toggleAllNodes(false);
  }

  private toggleAllNodes(expand: boolean) {
    const updatedTree = [...this.treeData];
    updatedTree.forEach((node) => this.toggleNodeRecursive(node, expand));
    this.treeData = updatedTree;
  }

  private toggleNodeRecursive(node: TreeNode, isExpand: boolean) {
    if (node.children && node.children.length > 0) {
      node.expanded = isExpand;
      node.children.forEach((child) =>
        this.toggleNodeRecursive(child, isExpand),
      );
    }
  }

  public onNodeSelect(event: { node: TreeNode }) {
    if (event.node && event.node.data) {
      this.selectedNodePath = event.node.data.path;
    }
  }

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

  public onSearch(query: string) {
    clearTimeout(this.searchDebounceTimer);

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

  private transformJsonToTreeNodes(data: any, path = '$'): TreeNode[] {
    if (data === null || typeof data !== 'object') {
      return [];
    }
    if (Array.isArray(data)) {
      return data.map((value, index) =>
        this.createNode(index.toString(), value, `${path}[${index}]`),
      );
    }
    return Object.entries(data).map(([key, value]) => {
      const needsEscaping = /[\.\s\-]/g.test(key) || !isNaN(Number(key[0]));
      const safePath = needsEscaping ? `${path}["${key}"]` : `${path}.${key}`;
      return this.createNode(key, value, safePath);
    });
  }

  private createNode(key: string, value: any, path: string): TreeNode {
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

  private filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    return nodes
      .map((node) => {
        const clonedNode = { ...node };

        if (clonedNode.children && clonedNode.children.length > 0) {
          const matchingChildren = this.filterTree(clonedNode.children, query);
          clonedNode.children = matchingChildren;

          if (matchingChildren.length > 0) {
            clonedNode.expanded = true;
            return clonedNode;
          }
        }

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
      .filter((node): node is TreeNode => node !== null);
  }

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

  public jumpToSource(jsonPath: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (!jsonPath) return;

    const segments: (string | number)[] = [];
    let i = 0;

    if (jsonPath.startsWith('$')) i++;

    while (i < jsonPath.length) {
      const char = jsonPath[i];

      if (char === '[') {
        i++; // Skip opening bracket '['

        if (jsonPath[i] === "'" || jsonPath[i] === '"') {
          const quoteChar = jsonPath[i];
          i++; // Skip opening quote
          let keyAccumulator = '';

          while (i < jsonPath.length && jsonPath[i] !== quoteChar) {
            keyAccumulator += jsonPath[i];
            i++;
          }
          segments.push(keyAccumulator);
          i++; // Skip closing quote
        } else {
          let indexAccumulator = '';
          while (i < jsonPath.length && jsonPath[i] !== ']') {
            indexAccumulator += jsonPath[i];
            i++;
          }
          segments.push(Number(indexAccumulator));
        }
        i++; // Skip closing bracket ']'
        continue;
      }

      if (char === '.') {
        i++; // Skip dot separator '.'
        let keyAccumulator = '';
        while (
          i < jsonPath.length &&
          jsonPath[i] !== '.' &&
          jsonPath[i] !== '['
        ) {
          keyAccumulator += jsonPath[i];
          i++;
        }
        if (keyAccumulator) {
          segments.push(keyAccumulator);
        }
        continue;
      }

      let plainKey = '';
      while (
        i < jsonPath.length &&
        jsonPath[i] !== '.' &&
        jsonPath[i] !== '['
      ) {
        plainKey += jsonPath[i];
        i++;
      }
      if (plainKey) {
        segments.push(plainKey);
      }
    }

    this.vscodeApiService.postMessage({
      command: 'jumpToPath',
      pathSegments: segments,
    });
  }
}
