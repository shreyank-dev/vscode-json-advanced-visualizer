import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { TabViewChangeEvent, TabViewModule } from 'primeng/tabview';
import { MessageModule } from 'primeng/message';

// Child Components
import { TreeViewComponent } from './libs/components/tree-view/tree-view.component';
import { TableViewComponent } from './libs/components/table-view/table-view.component';
import { ChartViewComponent } from './libs/components/chart-view/chart-view.component';

// Services
import { ThemeService } from './libs/services/theme.service';
import { VscodeApiService } from './libs/services/vscode-api.service';

/**
 * The root component of the webview application.
 * It acts as the main container and orchestrator, managing the overall state,
 * receiving data from the VS Code extension host, and passing it down to
 * the specialized view components within its tabs.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TabViewModule,
    ButtonModule,
    MessageModule,
    TreeViewComponent,
    TableViewComponent,
    ChartViewComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  /** A reference to the ChartViewComponent to call its public methods. */
  @ViewChild(ChartViewComponent) chartView: ChartViewComponent | undefined;

  private messageSubscription: Subscription | undefined;

  /** The parsed JSON data, passed to child components. */
  public parsedJson: any = null;

  /** A user-friendly error message if JSON parsing fails. */
  public jsonError: string | null = null;

  /** A flag indicating if the data is an array of objects, suitable for the Table View. */
  public isTableData: boolean = false;

  constructor(
    private ngZone: NgZone,
    private themeService: ThemeService,
    private vscodeApiService: VscodeApiService
  ) {
    // Initialize the theme service to listen for VS Code theme changes.
    this.themeService.initThemeListener();
  }

  /**
   * Listens for 'message' events from the VS Code extension host.
   * This is the entry point for all data coming into the webview.
   */
  ngOnInit() {
    this.messageSubscription = this.vscodeApiService.onMessage$.subscribe(
      (message) => {
        if (message.command === 'loadJson') {
          // Run updates inside NgZone to ensure change detection works reliably,
          // as the 'message' event originates outside of Angular's zone.
          this.ngZone.run(() => {
            try {
              this.parsedJson = JSON.parse(message.text);
              this.jsonError = null;

              // Determine if the parsed data is suitable for the table view.
              this.isTableData =
                Array.isArray(this.parsedJson) &&
                this.parsedJson.length > 0 &&
                typeof this.parsedJson[0] === 'object' &&
                this.parsedJson[0] !== null;
            } catch (error) {
              this.parsedJson = null;
              this.isTableData = false;
              this.jsonError =
                'Invalid JSON: Please select a valid JSON to visualize.';
              console.error('Error parsing JSON:', error);
            }
          });
        }
      }
    );
  }

  /**
   * Called when the active tab changes in the p-tabView.
   * This is used to trigger the ChartViewComponent to draw its chart,
   * as the chart can only be rendered when its container is visible in the DOM.
   * @param event The event emitted by the TabView, which includes the index of the selected tab.
   */
  onTabChange(event: TabViewChangeEvent) {
    // Current Order:
    // Index 0: Tree View
    // Index 1: Table View (if isTableData is true)
    // Index 2 or 1: Chart View
    const chartTabIndex = this.isTableData ? 2 : 1;

    if (event.index === chartTabIndex) {
      this.chartView?.drawChart();
    }
  }

  // Clean up the subscription to prevent memory leaks
  ngOnDestroy() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
}
