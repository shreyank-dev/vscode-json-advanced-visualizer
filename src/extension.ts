import * as vscode from "vscode";

/**
 * The main activation function for the extension.
 * This is called by VS Code the very first time a command from this extension is executed.
 * It sets up the command registration.
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
  // Register the main command for the extension.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "json-advanced-visualizer.visualizeSelection",
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage(
            "No active editor. Please open a file and select some JSON."
          );
          return;
        }
        const selection = editor.document.getText(editor.selection);
        if (!selection) {
          vscode.window.showInformationMessage(
            "No text selected. Please select valid JSON to visualize."
          );
          return;
        }

        // Create or show the webview panel.
        VisualizerPanel.createOrShow(context.extensionUri, selection);
      }
    )
  );
}

/**
 * Manages the state and behavior of the JSON visualizer webview panel.
 * It encapsulates the creation, content management, and communication for the panel.
 */
class VisualizerPanel {
  /** Tracks the currently open panel. Only one is allowed to exist at a time. */
  public static currentPanel: VisualizerPanel | undefined;

  public static readonly viewType = "jsonVisualizer";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates a new visualizer panel or shows the existing one.
   * @param extensionUri The URI of the extension's root directory.
   * @param selection The JSON text selected by the user.
   */
  public static createOrShow(extensionUri: vscode.Uri, selection: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (VisualizerPanel.currentPanel) {
      VisualizerPanel.currentPanel._panel.reveal(column);
      VisualizerPanel.currentPanel._sendJsonToWebview(selection);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      VisualizerPanel.viewType,
      "JSON Visualizer",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(
            extensionUri,
            "webview-ui",
            "json-visualizer-app",
            "dist",
            "json-visualizer-app",
            "browser"
          ),
        ],
      }
    );

    VisualizerPanel.currentPanel = new VisualizerPanel(
      panel,
      extensionUri,
      selection
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    selection: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial content
    this._panel.webview.html = this._getHtmlForWebview();

    // Listen for when the panel is disposed (e.g., when the user closes it)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "showInfo":
            vscode.window.showInformationMessage(message.text);
            return;
          case "showError":
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );

    // Send the initial JSON data to the webview
    this._sendJsonToWebview(selection);
  }

  /**
   * Sends a JSON string to be rendered in the webview.
   * @param jsonText The JSON string to visualize.
   */
  private _sendJsonToWebview(jsonText: string) {
    this._panel.webview.postMessage({ command: "loadJson", text: jsonText });
  }

  /**
   * Cleans up resources when the panel is closed.
   */
  public dispose() {
    VisualizerPanel.currentPanel = undefined;

    // Clean up our panel
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Generates the complete HTML content for the webview panel.
   * @returns The HTML string.
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const isDarkTheme =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const initialTheme = isDarkTheme ? "aura-dark-blue" : "aura-light-blue";
    const nonce = getNonce();

    // Get the base URI for the compiled Angular app
    const angularAppDistPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "json-visualizer-app",
      "dist",
      "json-visualizer-app",
      "browser"
    );

    // Create webview-safe URIs for all assets
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, "styles.css")
    );
    const themeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, `${initialTheme}.css`)
    );
    const polyfillsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, "polyfills.js")
    );
    const mainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, "main.js")
    );

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            style-src ${webview.cspSource} 'unsafe-inline';
            font-src ${webview.cspSource};
            img-src ${webview.cspSource};
            script-src 'nonce-${nonce}';
          ">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${stylesUri}" rel="stylesheet">
          <link id="app-theme" rel="stylesheet" type="text/css" href="${themeUri}">
          <title>JSON Visualizer</title>
      </head>
      <body>
          <app-root></app-root>
          <script nonce="${nonce}" type="module" src="${polyfillsUri}"></script>
          <script nonce="${nonce}" type="module" src="${mainUri}"></script>
      </body>
      </html>`;
  }
}

/**
 * Generates a random string to be used as a nonce for the Content Security Policy.
 * @returns A 32-character random string.
 */
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * This method is called when the extension is deactivated.
 * It can be used to clean up any resources.
 */
export function deactivate() {}
