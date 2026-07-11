import * as vscode from "vscode";
import { VisualizerPanel } from "./visualizer-panel";
import { SelectiveJsonCodeActionProvider } from "./selective-json-provider";

export function activate(context: vscode.ExtensionContext) {
  // Manual Selection Visualizer Command (Command Palette / Highlight Selection)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "json-advanced-visualizer.visualizeSelection",
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage("No active editor found.");
          return;
        }

        const selection = editor.document.getText(editor.selection);
        if (!selection) {
          vscode.window.showInformationMessage(
            "Please select valid JSON to visualize.",
          );
          return;
        }

        VisualizerPanel.createNewPanel(
          context.extensionUri,
          selection,
          editor.document.uri,
        );
      },
    ),
  );

  // Inline Target Range Scanner Dispatcher Link Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "json-advanced-visualizer.visualizeTargetRange",
      (rangeText: string, documentUri: vscode.Uri) => {
        VisualizerPanel.createNewPanel(
          context.extensionUri,
          rangeText,
          documentUri,
        );
      },
    ),
  );

  // Register the No-Icon Structural Data Block CodeAction Provider
  const selector: vscode.DocumentSelector = { scheme: "file" };
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      selector,
      new SelectiveJsonCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.RefactorInline],
      },
    ),
  );
}

export function deactivate() {}
