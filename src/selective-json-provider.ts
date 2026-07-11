import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";

/**
 * State-Aware Balanced Bracket Character Scanner.
 * Isolates complete sub-blocks within non-strict JS/TS files while ignoring strings and comments.
 */
function scanBalancedBlock(
  text: string,
  startMatchIndex: number,
  startChar: "{" | "[",
): { cleanSnippet: string; endOffset: number } | null {
  const endChar = startChar === "{" ? "}" : "]";
  let depth = 1;
  let scanIndex = startMatchIndex + 1;

  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  while (depth > 0 && scanIndex < text.length) {
    const char = text[scanIndex];
    const nextChar = text[scanIndex + 1];

    if (char === "\\" && inString) {
      scanIndex += 2;
      continue;
    }

    if (!inString && !inLineComment && !inBlockComment) {
      if (char === "/" && nextChar === "/") {
        inLineComment = true;
        scanIndex += 2;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        inBlockComment = true;
        scanIndex += 2;
        continue;
      }
    }

    if (inLineComment && (char === "\n" || char === "\r")) {
      inLineComment = false;
    }

    if (inBlockComment && char === "*" && nextChar === "/") {
      inBlockComment = false;
      scanIndex += 2;
      continue;
    }

    if (!inLineComment && !inBlockComment) {
      if ((char === '"' || char === "'" || char === "`") && !inString) {
        inString = char;
      } else if (char === inString) {
        inString = null;
      }
    }

    if (!inString && !inLineComment && !inBlockComment) {
      if (char === startChar) depth++;
      else if (char === endChar) depth--;
    }

    scanIndex++;
  }

  if (depth === 0) {
    return {
      cleanSnippet: text.substring(startMatchIndex, scanIndex),
      endOffset: scanIndex,
    };
  }

  return null;
}

/**
 * Selective JSON Code Action Provider.
 * Monitors cursor positions and detects both variable assignments and direct standalone JSON blocks.
 */
export class SelectiveJsonCodeActionProvider
  implements vscode.CodeActionProvider
{
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const codeActions: vscode.CodeAction[] = [];

    const lineIndex = range.start.line;
    const lineText = document.lineAt(lineIndex).text;

    // Matches assignments (= or :), direct block openings, or standalone lines starting with { or [
    const universalDataBlockRegex = /(?:=\s*|:\s*|^|\s)([\{\[])/g;
    let match: RegExpExecArray | null;

    while ((match = universalDataBlockRegex.exec(lineText)) !== null) {
      if (token.isCancellationRequested) break;

      const startChar = match[1] as "{" | "[";
      const localMatchIndex = match.index + match[0].indexOf(startChar);
      const globalMatchIndex = document.offsetAt(
        new vscode.Position(lineIndex, localMatchIndex),
      );

      const fullText = document.getText();
      const scanResult = scanBalancedBlock(
        fullText,
        globalMatchIndex,
        startChar,
      );
      if (!scanResult) continue;

      const parsedAst = jsonc.parseTree(scanResult.cleanSnippet);
      if (
        parsedAst &&
        (parsedAst.type === "object" || parsedAst.type === "array")
      ) {
        const action = new vscode.CodeAction(
          `Visualize Structural Data Block (${parsedAst.type})`,
          vscode.CodeActionKind.RefactorInline,
        );

        action.command = {
          title: "Visualize Target Range",
          command: "json-advanced-visualizer.visualizeTargetRange",
          arguments: [scanResult.cleanSnippet, document.uri],
        };

        codeActions.push(action);
        break;
      }
    }

    return codeActions;
  }
}
