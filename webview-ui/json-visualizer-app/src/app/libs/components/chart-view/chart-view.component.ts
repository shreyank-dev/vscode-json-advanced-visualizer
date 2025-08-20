import { Component, Input, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { ChartModule, UIChart } from 'primeng/chart';
import { PanelModule } from 'primeng/panel';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FieldsetModule } from 'primeng/fieldset';
import { Message } from 'primeng/api';

// Services
import { ThemeService } from '../../services/theme.service';

// --- Best Practice: Define constants for string literals ---
const FIELD_TYPE = {
  CATEGORICAL: 'Categorical',
  NUMERICAL: 'Numerical',
  TEMPORAL: 'Temporal',
  HIGH_CARDINALITY: 'High-Cardinality',
} as const;

const CHART_TYPE = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  DOUGHNUT: 'doughnut',
  SCATTER: 'scatter',
} as const;

const AGGREGATION = {
  COUNT: 'count',
  SUM: 'sum',
  AVERAGE: 'average',
} as const;

// --- Interfaces ---
interface DataSource {
  label: string;
  value: any[];
}
type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE];
interface FieldAnalysis {
  name: string;
  type: FieldType;
}

/**
 * The ChartViewComponent automatically analyzes JSON data (specifically arrays of objects)
 * and generates interactive charts. It features a "Smart Suggestion Engine" to pick
 * a relevant initial chart and a control panel for manual user exploration.
 */
@Component({
  selector: 'app-chart-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    PanelModule,
    DropdownModule,
    ProgressSpinnerModule,
    FieldsetModule,
  ],
  templateUrl: './chart-view.component.html',
  styleUrls: ['./chart-view.component.scss'],
})
export class ChartViewComponent {
  /** A direct reference to the p-chart component instance to call its methods like reinit(). */
  @ViewChild('theChart') chartComponent: UIChart | undefined;

  /** The raw JSON data passed from the parent AppComponent. */
  private _jsonData: any;
  @Input()
  set jsonData(data: any) {
    if (data) {
      this._jsonData = data;
      this.runSmartEngine();
    }
  }

  // --- UI State ---
  public isLoading: boolean = false;
  public isChartAvailable: boolean = false;
  public noDataMessage: string =
    'No chartable data found. This feature works best with arrays of objects.';

  // --- Control Panel State ---
  public dataSources: DataSource[] = [];
  public selectedDataSource: any[] | null = null;
  public analyzedFields: FieldAnalysis[] = [];

  public chartTypes = [
    { label: 'Bar', value: CHART_TYPE.BAR },
    { label: 'Line', value: CHART_TYPE.LINE },
    { label: 'Pie', value: CHART_TYPE.PIE },
    { label: 'Doughnut', value: CHART_TYPE.DOUGHNUT },
    { label: 'Scatter', value: CHART_TYPE.SCATTER },
  ];
  public selectedChartType: (typeof CHART_TYPE)[keyof typeof CHART_TYPE] =
    CHART_TYPE.BAR;

  public aggregations = [
    { label: 'Count', value: AGGREGATION.COUNT },
    { label: 'Sum', value: AGGREGATION.SUM },
    { label: 'Average', value: AGGREGATION.AVERAGE },
  ];
  public selectedAggregation: string = AGGREGATION.COUNT;

  public selectedXAxisField: string | null = null;
  public selectedYAxisField: string | null = null;

  /** The final data object passed to the p-chart component. */
  public chartData: any;
  /** The final options object passed to the p-chart component. */
  public chartOptions: any;

  private analysisComplete: boolean = false;

  constructor(
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  /** A derived property that creates dropdown options from the analyzed fields. */
  get fieldOptions() {
    return this.analyzedFields.map((f) => ({ label: f.name, value: f.name }));
  }

  /** Public API for the parent component to call when this tab becomes visible. */
  public drawChart() {
    if (!this.analysisComplete || this.isChartAvailable) return;
    this.isLoading = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.applyHeuristicsAndDrawChart();
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 50);
  }

  /** Event handler for when the user selects a new chart type. */
  public onChartTypeChange() {
    if (
      this.selectedChartType === CHART_TYPE.PIE ||
      this.selectedChartType === CHART_TYPE.DOUGHNUT
    ) {
      this.selectedYAxisField = null;
      this.selectedAggregation = AGGREGATION.COUNT;
    } else if (this.selectedChartType === CHART_TYPE.SCATTER) {
      this.selectedAggregation = AGGREGATION.COUNT; // Placeholder, not used
    }
    this.updateChart();
  }

  /** The main orchestration method for the Smart Suggestion Engine. */
  private runSmartEngine() {
    if (!this._jsonData) return;
    this.dataSources = this.findDataSources(this._jsonData);
    if (this.dataSources.length > 0) {
      this.selectedDataSource = this.dataSources.sort(
        (a, b) => b.value.length - a.value.length
      )[0].value;
      this.analyzedFields = this.analyzeFields(this.selectedDataSource);
      this.analysisComplete = true;
    }
  }

  /** Applies heuristic rules to select and configure the best initial chart. */
  private applyHeuristicsAndDrawChart() {
    const temporal = this.analyzedFields.find(
      (f) => f.type === FIELD_TYPE.TEMPORAL
    );
    const numerical = this.analyzedFields.find(
      (f) => f.type === FIELD_TYPE.NUMERICAL
    );
    const categorical = this.analyzedFields.find(
      (f) => f.type === FIELD_TYPE.CATEGORICAL
    );

    if (temporal && numerical) {
      this.selectedChartType = CHART_TYPE.LINE;
      this.selectedXAxisField = temporal.name;
      this.selectedYAxisField = numerical.name;
      this.selectedAggregation = AGGREGATION.AVERAGE;
    } else if (categorical && numerical) {
      this.selectedChartType = CHART_TYPE.BAR;
      this.selectedXAxisField = categorical.name;
      this.selectedYAxisField = numerical.name;
      this.selectedAggregation = AGGREGATION.AVERAGE;
    } else if (categorical) {
      this.selectedChartType = CHART_TYPE.PIE;
      this.selectedXAxisField = categorical.name;
      this.selectedYAxisField = null;
      this.selectedAggregation = AGGREGATION.COUNT;
    } else {
      this.isChartAvailable = false;
      this.noDataMessage =
        'Could not find a suitable combination of fields to generate a chart automatically.';
      return;
    }

    this.updateChart();
    setTimeout(() => {
      this.chartComponent?.reinit();
    }, 0);
  }

  /** The central rendering function that builds the chart objects. */
  public updateChart() {
    if (!this.selectedDataSource || !this.selectedXAxisField) {
      this.isChartAvailable = false;
      return;
    }

    let labels: (string | number)[] = [];
    let data: any[] = [];
    let datasetLabel = '';

    if (this.selectedChartType === CHART_TYPE.SCATTER) {
      if (!this.selectedYAxisField) {
        this.isChartAvailable = false;
        return;
      }
      datasetLabel = `${this.selectedYAxisField} vs. ${this.selectedXAxisField}`;
      data = this.selectedDataSource.map((item) => ({
        x: item[this.selectedXAxisField!],
        y: item[this.selectedYAxisField!],
      }));
    } else {
      const rawLabels = [
        ...new Set(
          this.selectedDataSource.map((item) => item[this.selectedXAxisField!])
        ),
      ];
      labels = rawLabels.map((label) =>
        this.isObject(label) ? JSON.stringify(label) : label
      );
      datasetLabel = this.selectedYAxisField || this.selectedXAxisField!;

      if (
        this.selectedChartType === CHART_TYPE.PIE ||
        this.selectedChartType === CHART_TYPE.DOUGHNUT ||
        this.selectedAggregation === AGGREGATION.COUNT
      ) {
        const counts = new Map<string | number, number>();
        for (const item of this.selectedDataSource) {
          const key = item[this.selectedXAxisField!];
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        data = labels.map((label) => counts.get(label) || 0);
      } else if (this.selectedYAxisField) {
        const groups = new Map<string | number, number[]>();
        for (const item of this.selectedDataSource) {
          const key = item[this.selectedXAxisField!];
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(item[this.selectedYAxisField]);
        }
        data = labels.map((label) => {
          const values = groups.get(label) || [0];
          const sum = values.reduce((acc, val) => acc + val, 0);
          if (this.selectedAggregation === AGGREGATION.SUM) return sum;
          if (this.selectedAggregation === AGGREGATION.AVERAGE)
            return sum / values.length;
          return 0;
        });
      }
    }

    const isDark = this.themeService.isDarkTheme();
    const textColor = isDark ? '#d4d4d4' : '#333333';
    const gridColor = isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)';
    const darkThemeColors = [
      '#2dd4bf',
      '#a78bfa',
      '#f87171',
      '#fbbf24',
      '#60a5fa',
      '#f472b6',
    ];
    const lightThemeColors = [
      '#0d9488',
      '#7c3aed',
      '#dc2626',
      '#d97706',
      '#2563eb',
      '#db2777',
    ];

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: datasetLabel,
          data: data,
          backgroundColor: isDark ? darkThemeColors : lightThemeColors,
        },
      ],
    };

    const yAxisType = this.analyzedFields.find(
      (f) => f.name === this.selectedYAxisField
    )?.type;
    this.chartOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        title: {
          display: true,
          text: this.generateChartTitle(),
          color: textColor,
          font: { size: 14 },
        },
        tooltip: this.getTooltipCallbacks(),
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor },
          title: {
            display: true,
            text: this.selectedXAxisField,
            color: textColor,
          },
        },
        y: {
          ticks: {
            color: textColor,
            ...(yAxisType === FIELD_TYPE.NUMERICAL && { maxTicksLimit: 8 }),
          },
          grid: { color: gridColor },
          title: {
            display: true,
            text: this.selectedYAxisField || 'Count',
            color: textColor,
          },
        },
      },
    };

    if (
      this.selectedChartType === CHART_TYPE.PIE ||
      this.selectedChartType === CHART_TYPE.DOUGHNUT
    ) {
      delete this.chartOptions.scales;
    }
    this.isChartAvailable = true;
  }

  /** Analyzes and classifies the fields of a given dataset. */
  private analyzeFields(dataSource: any[]): FieldAnalysis[] {
    if (!dataSource || dataSource.length === 0) return [];
    const sample = dataSource.slice(0, 50);
    const keys = Object.keys(sample[0]);
    const analysis = keys.map((key) => {
      const firstValue = sample[0][key];
      if (typeof firstValue === 'object' && firstValue !== null) return null;
      const uniqueValues = new Set(sample.map((item) => item[key]));
      if (
        typeof firstValue === 'number' &&
        sample.every((item) => typeof item[key] === 'number')
      ) {
        return { name: key, type: FIELD_TYPE.NUMERICAL };
      }
      if (
        typeof firstValue === 'string' &&
        !isNaN(new Date(firstValue).getTime())
      ) {
        if (
          sample.every(
            (item) =>
              typeof item[key] === 'string' &&
              !isNaN(new Date(item[key]).getTime())
          )
        ) {
          return { name: key, type: FIELD_TYPE.TEMPORAL };
        }
      }
      if (typeof firstValue === 'string') {
        if (
          uniqueValues.size <= 12 ||
          uniqueValues.size / sample.length < 0.5
        ) {
          return { name: key, type: FIELD_TYPE.CATEGORICAL };
        } else {
          return { name: key, type: FIELD_TYPE.HIGH_CARDINALITY };
        }
      }
      return null;
    });
    return analysis.filter(Boolean) as FieldAnalysis[];
  }

  /**
   * Recursively finds all arrays of objects in the data.
   */
  private findDataSources(
    data: any,
    path: string = '$',
    sources: DataSource[] = []
  ): DataSource[] {
    if (!data) return sources;
    if (
      Array.isArray(data) &&
      data.length > 0 &&
      typeof data[0] === 'object' &&
      data[0] !== null
    ) {
      sources.push({ label: path, value: data });
    }
    if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const newPath = Array.isArray(data)
            ? `${path}[${key}]`
            : `${path}.${key}`;
          this.findDataSources(data[key], newPath, sources);
        }
      }
    }
    return sources;
  }

  /**
   * Generates the configuration object for Chart.js tooltips.
   * @returns A Chart.js tooltip configuration object.
   */
  private getTooltipCallbacks() {
    return {
      callbacks: {
        label: (tooltipItem: any) => {
          const chartType = tooltipItem.chart.config.type;

          if (
            chartType === CHART_TYPE.PIE ||
            chartType === CHART_TYPE.DOUGHNUT
          ) {
            const label = tooltipItem.label || '';
            const value = tooltipItem.raw || 0;
            return `${label}: ${value}`;
          }

          if (chartType === CHART_TYPE.BAR || chartType === CHART_TYPE.LINE) {
            const aggregation = this.selectedAggregation || AGGREGATION.COUNT;
            const field =
              this.selectedYAxisField || this.selectedXAxisField || '';
            const formattedAggregation =
              aggregation.charAt(0).toUpperCase() + aggregation.slice(1);
            return `${formattedAggregation} of ${field}: ${tooltipItem.formattedValue}`;
          }

          if (chartType === CHART_TYPE.SCATTER) {
            return `(${tooltipItem.raw.x}, ${tooltipItem.raw.y})`;
          }

          return tooltipItem.formattedValue; // Fallback
        },
      },
    };
  }

  /** Generates a dynamic and descriptive title for the chart. */
  private generateChartTitle(): string {
    const chartType = this.selectedChartType;
    if (chartType === 'pie' || chartType === 'doughnut') {
      return `Count of ${this.selectedXAxisField}`;
    }
    if (chartType === 'scatter') {
      return `${this.selectedYAxisField} vs. ${this.selectedXAxisField}`;
    }
    // For Bar/Line charts
    return `${this.selectedAggregation} of ${
      this.selectedYAxisField || this.selectedXAxisField
    } by ${this.selectedXAxisField}`;
  }

  /** Helper to check if a value is an object or array. */
  private isObject(value: any): boolean {
    return value !== null && typeof value === 'object';
  }
}
