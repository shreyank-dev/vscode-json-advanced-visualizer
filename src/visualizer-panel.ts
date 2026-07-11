import * as vscode from "vscode";
import { handleJumpToPath } from "./jump-handler";

export class VisualizerPanel {
  private static _openPanels = new Map<string, VisualizerPanel>();
  public static readonly viewType = "jsonVisualizer";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _sourceDocumentUri: vscode.Uri;
  private _initialSelectionText: string;
  private _disposables: vscode.Disposable[] = [];

  public static createNewPanel(
    extensionUri: vscode.Uri,
    selection: string,
    sourceUri: vscode.Uri,
  ) {
    const uriKey = sourceUri.toString();

    if (VisualizerPanel._openPanels.has(uriKey)) {
      const existingPanel = VisualizerPanel._openPanels.get(uriKey);
      existingPanel?._panel.reveal(vscode.ViewColumn.Beside);
      existingPanel?._updatePanelState(selection);
      return;
    }

    const fileName = sourceUri.path.split("/").pop() || "Selection";
    const panel = vscode.window.createWebviewPanel(
      VisualizerPanel.viewType,
      `JSON Lens: ${fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(
            extensionUri,
            "webview-ui",
            "json-visualizer-app",
            "dist",
            "json-visualizer-app",
            "browser",
          ),
        ],
      },
    );

    const newInstance = new VisualizerPanel(
      panel,
      extensionUri,
      selection,
      sourceUri,
    );
    VisualizerPanel._openPanels.set(uriKey, newInstance);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    selection: string,
    sourceUri: vscode.Uri,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._sourceDocumentUri = sourceUri;
    this._initialSelectionText = selection;

    this._panel.webview.html = this._getHtmlForWebview();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "jumpToPath":
            await handleJumpToPath(
              message.pathSegments,
              this._sourceDocumentUri,
              this._initialSelectionText,
            );
            break;
          case "showInfo":
            vscode.window.showInformationMessage(message.text);
            return;
          case "showError":
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables,
    );

    this._sendJsonToWebview(selection);
  }

  private _updatePanelState(newSelectionText: string) {
    this._initialSelectionText = newSelectionText;
    this._sendJsonToWebview(newSelectionText);
  }

  private _sendJsonToWebview(jsonText: string) {
    this._panel.webview.postMessage({ command: "loadJson", text: jsonText });
  }

  public dispose() {
    VisualizerPanel._openPanels.delete(this._sourceDocumentUri.toString());
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      x?.dispose();
    }
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const isDarkTheme =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const initialTheme = isDarkTheme ? "aura-dark-blue" : "aura-light-blue";
    const nonce = getNonce();

    const angularAppDistPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "json-visualizer-app",
      "dist",
      "json-visualizer-app",
      "browser",
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, "styles.css"),
    );
    const themeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, `${initialTheme}.css`),
    );
    const polyfillsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, "polyfills.js"),
    );
    const mainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(angularAppDistPath, "main.js"),
    );

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
