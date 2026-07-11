import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";

/**
 * Handles high-precision jump-to-source logic by aligning cached snippets
 * with the document's global Abstract Syntax Tree coordinate space.
 */
export async function handleJumpToPath(
  pathSegments: jsonc.Segment[],
  sourceUri: vscode.Uri,
  cachedSelectionText: string,
) {
  try {
    const document = await vscode.workspace.openTextDocument(sourceUri);
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });

    const fullDocumentText = document.getText();
    let parsingContextText = fullDocumentText;
    let codeOffsetDelta = 0;

    if (cachedSelectionText.length > 0) {
      const localEqualsIndex = cachedSelectionText.indexOf("=");

      if (
        localEqualsIndex !== -1 &&
        !cachedSelectionText.trim().startsWith("{") &&
        !cachedSelectionText.trim().startsWith("[")
      ) {
        const rawJsonSnippet = cachedSelectionText
          .substring(localEqualsIndex + 1)
          .trim();
        const globalFragmentOffset = fullDocumentText.indexOf(rawJsonSnippet);

        if (globalFragmentOffset !== -1) {
          codeOffsetDelta = globalFragmentOffset;
          parsingContextText = rawJsonSnippet;
        }
      } else {
        const globalFragmentOffset =
          fullDocumentText.indexOf(cachedSelectionText);
        if (globalFragmentOffset !== -1) {
          codeOffsetDelta = globalFragmentOffset;
          parsingContextText = cachedSelectionText;
        }
      }
    }

    const rootNode = jsonc.parseTree(parsingContextText);
    if (!rootNode) return;

    const targetNode = jsonc.findNodeAtLocation(rootNode, pathSegments);

    if (targetNode) {
      const finalNode =
        targetNode.parent && targetNode.parent.type === "property"
          ? targetNode.parent
          : targetNode;

      const startPosition = document.positionAt(
        codeOffsetDelta + finalNode.offset,
      );
      const endPosition = document.positionAt(
        codeOffsetDelta + finalNode.offset + finalNode.length,
      );

      editor.selection = new vscode.Selection(startPosition, startPosition);
      editor.revealRange(
        new vscode.Range(startPosition, endPosition),
        vscode.TextEditorRevealType.InCenter,
      );
    }
  } catch (error) {
    console.error(
      "Error executing precise coordinates jump lookup path:",
      error,
    );
  }
}
