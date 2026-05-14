// web/assets/js/admin/charts/chartHelpers.js
// Chart.js wrapper utilities for dashboard analytics

// Color palette for charts (brand-aligned)
const CHART_COLORS = {
  primary: "#0765ff",
  accent: "#e9c001",
  success: "#059669",
  warning: "#f59e0b",
  danger: "#dc2626",
  gray: "#6b7280",
};

const CHART_PALETTE = [
  "#0765ff", // primary blue
  "#e9c001", // accent yellow
  "#059669", // green
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

// Store chart instances for cleanup
const chartInstances = new Map();

/**
 * Destroy an existing chart instance if it exists
 * @param {string|HTMLCanvasElement} canvasOrId - Canvas element or ID
 */
export function destroyChart(canvasOrId) {
  const id = typeof canvasOrId === "string" ? canvasOrId : canvasOrId?.id;
  if (!id) return;

  const existing = chartInstances.get(id);
  if (existing) {
    existing.destroy();
    chartInstances.delete(id);
  }
}

/**
 * Get or create canvas context
 * @param {string|HTMLCanvasElement} canvasOrId
 * @returns {CanvasRenderingContext2D|null}
 */
function getCanvasContext(canvasOrId) {
  const canvas =
    typeof canvasOrId === "string"
      ? document.getElementById(canvasOrId)
      : canvasOrId;

  if (!canvas) {
    console.warn(`[chartHelpers] Canvas not found: ${canvasOrId}`);
    return null;
  }

  return canvas.getContext("2d");
}

/**
 * Check if Chart.js is loaded
 * @returns {boolean}
 */
function isChartJsLoaded() {
  return typeof window.Chart !== "undefined";
}

/**
 * Create a pie/doughnut chart
 * @param {string|HTMLCanvasElement} canvasOrId
 * @param {Object} data - { labels: string[], values: number[] }
 * @param {Object} options - Additional options
 * @returns {Chart|null}
 */
export function createPieChart(canvasOrId, data, options = {}) {
  if (!isChartJsLoaded()) {
    console.warn("[chartHelpers] Chart.js not loaded");
    return null;
  }

  const ctx = getCanvasContext(canvasOrId);
  if (!ctx) return null;

  const id = typeof canvasOrId === "string" ? canvasOrId : canvasOrId?.id;
  destroyChart(id);

  const chart = new window.Chart(ctx, {
    type: options.doughnut ? "doughnut" : "pie",
    data: {
      labels: data.labels || [],
      datasets: [
        {
          data: data.values || [],
          backgroundColor: data.colors || CHART_PALETTE.slice(0, (data.values || []).length),
          borderWidth: 1,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: options.legendPosition || "bottom",
          labels: {
            padding: 12,
            usePointStyle: true,
            font: { size: 11 },
          },
        },
        title: {
          display: !!options.title,
          text: options.title || "",
          font: { size: 14, weight: "bold" },
          padding: { bottom: 10 },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              if (options.valueFormatter) {
                return `${label}: ${options.valueFormatter(value)} (${pct}%)`;
              }
              return `${label}: ${value} (${pct}%)`;
            },
          },
        },
      },
      ...options.chartOptions,
    },
  });

  if (id) chartInstances.set(id, chart);
  return chart;
}

/**
 * Create a bar chart
 * @param {string|HTMLCanvasElement} canvasOrId
 * @param {Object} data - { labels: string[], values: number[], label?: string }
 * @param {Object} options - Additional options
 * @returns {Chart|null}
 */
export function createBarChart(canvasOrId, data, options = {}) {
  if (!isChartJsLoaded()) {
    console.warn("[chartHelpers] Chart.js not loaded");
    return null;
  }

  const ctx = getCanvasContext(canvasOrId);
  if (!ctx) return null;

  const id = typeof canvasOrId === "string" ? canvasOrId : canvasOrId?.id;
  destroyChart(id);

  // For horizontal bars with labels on bars, hide y-axis labels
  const showLabelsOnBars = options.horizontal && options.labelsOnBars;

  const chart = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: data.label || "",
          data: data.values || [],
          backgroundColor: options.color || CHART_COLORS.primary,
          borderRadius: 4,
          barThickness: options.barThickness || (showLabelsOnBars ? 24 : "flex"),
        },
      ],
    },
    options: {
      indexAxis: options.horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      layout: showLabelsOnBars ? { padding: { left: 10 } } : {},
      plugins: {
        legend: {
          display: !!data.label,
          position: "top",
        },
        title: {
          display: !!options.title,
          text: options.title || "",
          font: { size: 14, weight: "bold" },
          padding: { bottom: 10 },
        },
      },
      scales: {
        x: {
          grid: { display: !options.horizontal },
          ticks: { font: { size: 11 } },
          beginAtZero: true,
        },
        y: {
          grid: { display: options.horizontal },
          beginAtZero: true,
          ticks: {
            display: !showLabelsOnBars,
            font: { size: 11 },
            callback: options.yAxisFormatter || undefined,
          },
        },
      },
      ...options.chartOptions,
    },
    plugins: showLabelsOnBars ? [{
      id: 'barLabels',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        const labels = chart.data.labels;

        ctx.save();
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'middle';

        meta.data.forEach((bar, index) => {
          const label = labels[index] || '';
          const value = chart.data.datasets[0].data[index];
          const barWidth = bar.width;
          const textWidth = ctx.measureText(label).width;
          const valueText = String(value);
          const valueWidth = ctx.measureText(valueText).width;

          // Position label at start of bar, value at end
          const y = bar.y;
          const barStart = bar.base;
          const barEnd = bar.x;

          // Draw label (event name) - inside bar if fits, otherwise outside
          const labelPadding = 6;
          if (textWidth + labelPadding * 2 < barWidth) {
            // Label fits inside bar
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(label, barStart + labelPadding, y);
          } else {
            // Label outside bar (to the left)
            ctx.fillStyle = '#374151';
            ctx.textAlign = 'left';
            ctx.fillText(label, barStart + labelPadding, y);
          }

          // Draw value at end of bar
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'left';
          ctx.fillText(valueText, barEnd + 6, y);
        });

        ctx.restore();
      }
    }] : [],
  });

  if (id) chartInstances.set(id, chart);
  return chart;
}

/**
 * Create a line chart
 * @param {string|HTMLCanvasElement} canvasOrId
 * @param {Object} data - { labels: string[], values: number[], label?: string }
 * @param {Object} options - Additional options
 * @returns {Chart|null}
 */
export function createLineChart(canvasOrId, data, options = {}) {
  if (!isChartJsLoaded()) {
    console.warn("[chartHelpers] Chart.js not loaded");
    return null;
  }

  const ctx = getCanvasContext(canvasOrId);
  if (!ctx) return null;

  const id = typeof canvasOrId === "string" ? canvasOrId : canvasOrId?.id;
  destroyChart(id);

  const chart = new window.Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: data.label || "",
          data: data.values || [],
          borderColor: options.color || CHART_COLORS.primary,
          backgroundColor: options.fill
            ? (options.color || CHART_COLORS.primary) + "20"
            : "transparent",
          fill: options.fill || false,
          tension: options.smooth ? 0.3 : 0,
          pointRadius: options.showPoints === false ? 0 : 4,
          pointBackgroundColor: options.color || CHART_COLORS.primary,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !!data.label,
          position: "top",
        },
        title: {
          display: !!options.title,
          text: options.title || "",
          font: { size: 14, weight: "bold" },
          padding: { bottom: 10 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e5e7eb" },
          ticks: {
            font: { size: 11 },
            callback: options.yAxisFormatter || undefined,
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
      ...options.chartOptions,
    },
  });

  if (id) chartInstances.set(id, chart);
  return chart;
}

/**
 * Create a horizontal bar chart (convenience wrapper)
 * @param {string|HTMLCanvasElement} canvasOrId
 * @param {Object} data
 * @param {Object} options
 * @returns {Chart|null}
 */
export function createHorizontalBarChart(canvasOrId, data, options = {}) {
  return createBarChart(canvasOrId, data, { ...options, horizontal: true });
}

/**
 * Destroy all tracked chart instances
 */
export function destroyAllCharts() {
  for (const [id, chart] of chartInstances) {
    chart.destroy();
  }
  chartInstances.clear();
}

// Export color constants for external use
export { CHART_COLORS, CHART_PALETTE };
