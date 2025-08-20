import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

declare const acquireVsCodeApi: any;

interface VsCodeApi {
  postMessage(message: any): void;
}

/**
 * A singleton service that acts as the central hub for all communication
 * between the Angular webview and the VS Code extension host.
 */
@Injectable({
  providedIn: 'root',
})
export class VscodeApiService {
  private readonly vscodeApi: VsCodeApi | undefined;

  // Use a Subject to broadcast incoming messages to any interested components.
  private messageSubject = new Subject<any>();

  // An Observable that components can subscribe to, to receive messages from the extension.
  public readonly onMessage$ = this.messageSubject.asObservable();

  constructor() {
    // Add a safety check in case the app is run outside of a VS Code webview
    if (typeof acquireVsCodeApi === 'function') {
      this.vscodeApi = acquireVsCodeApi();
      this.setupMessageListener();
    } else {
      console.warn(
        'VS Code API not found. Running in a standard browser environment.'
      );
    }
  }

  /**
   * Sets up a listener for messages from the extension and broadcasts them.
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      this.messageSubject.next(event.data);
    });
  }

  /**
   * Posts a message to the extension host.
   * @param message The message to send.
   */
  public postMessage(message: any) {
    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
    } else {
      console.log('PostMessage (Browser Mock):', message);
    }
  }
}
