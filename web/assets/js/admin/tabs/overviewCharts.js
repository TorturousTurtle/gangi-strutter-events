// web/assets/js/admin/tabs/overviewCharts.js
// Dashboard analytics charts for the Overview tab

import {
  createLineChart,
  createPieChart,
  createBarChart,
  createHorizontalBarChart,
  destroyAllCharts,
  CHART_COLORS,
} from "../charts/chartHelpers.js";

/**
 * Initialize the overview charts module
 * @returns {Object} Module API with renderCharts method
 */
export function initOverviewCharts() {
  const CHART_IDS = {
    registrationTrend: "chart-registration-trend",
    revenueBreakdown: "chart-revenue-breakdown",
    ageDistribution: "chart-age-distribution",
    eventPopularity: "chart-event-popularity",
  };

  /**
   * Format currency for display
   * @param {number} value
   * @returns {string}
   */
  function formatMoney(value) {
    return "$" + Number(value).toFixed(2);
  }

  /**
   * Compute registration trend data (registrations over time)
   * @param {Array} regs - Registration records
   * @returns {Object} { labels, values }
   */
  function computeRegistrationTrend(regs) {
    if (!regs || regs.length === 0) {
      return { labels: [], values: [] };
    }

    // Group by date
    const byDate = new Map();

    for (const r of regs) {
      const createdAt = r.createdAt || r.created_at || "";
      if (!createdAt) continue;

      // Extract date part (YYYY-MM-DD)
      const dateStr = createdAt.slice(0, 10);
      byDate.set(dateStr, (byDate.get(dateStr) || 0) + 1);
    }

    // Sort dates and build cumulative or daily counts
    const sortedDates = Array.from(byDate.keys()).sort();

    // If many dates, show cumulative; if few, show daily
    const useCumulative = sortedDates.length > 7;

    const labels = [];
    const values = [];
    let cumulative = 0;

    for (const date of sortedDates) {
      const count = byDate.get(date);
      cumulative += count;

      // Format date for display
      const d = new Date(date + "T00:00:00");
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

      labels.push(label);
      values.push(useCumulative ? cumulative : count);
    }

    return { labels, values, cumulative: useCumulative };
  }

  /**
   * Compute revenue breakdown data
   * @param {Array} regs - Registration records
   * @returns {Object} { labels, values }
   */
  function computeRevenueBreakdown(regs) {
    if (!regs || regs.length === 0) {
      return { labels: [], values: [] };
    }

    let eventRevenue = 0;
    let facilityFeeRevenue = 0;
    let productRevenue = 0;

    for (const r of regs) {
      // Event subtotal
      eventRevenue += Number(r.eventSubtotal) || 0;

      // Facility fee
      facilityFeeRevenue += Number(r.facilityFee) || 0;

      // Optional product
      if (r.optionalProductSelected === 1) {
        productRevenue += Number(r.optionalProductPrice) || 0;
      }
    }

    const labels = [];
    const values = [];

    if (eventRevenue > 0) {
      labels.push("Events");
      values.push(eventRevenue);
    }
    if (facilityFeeRevenue > 0) {
      labels.push("Facility Fees");
      values.push(facilityFeeRevenue);
    }
    if (productRevenue > 0) {
      labels.push("Products");
      values.push(productRevenue);
    }

    return { labels, values };
  }

  /**
   * Compute age division distribution
   * @param {Array} regs - Registration records
   * @returns {Object} { labels, values }
   */
  function computeAgeDistribution(regs) {
    if (!regs || regs.length === 0) {
      return { labels: [], values: [] };
    }

    const byDivision = new Map();

    for (const r of regs) {
      const division = String(r.ageDivision || r.age_division || "").trim() || "Unknown";
      byDivision.set(division, (byDivision.get(division) || 0) + 1);
    }

    // Sort by count descending
    const sorted = Array.from(byDivision.entries()).sort((a, b) => b[1] - a[1]);

    return {
      labels: sorted.map(([label]) => label),
      values: sorted.map(([, count]) => count),
    };
  }

  /**
   * Compute event popularity (entries per event)
   * @param {Array} regs - Registration records
   * @returns {Object} { labels, values }
   */
  function computeEventPopularity(regs) {
    if (!regs || regs.length === 0) {
      return { labels: [], values: [] };
    }

    const byEvent = new Map();

    for (const r of regs) {
      const selections = Array.isArray(r.eventSelections) ? r.eventSelections : [];
      for (const sel of selections) {
        const name = String(sel.name || "").trim();
        if (!name) continue;
        byEvent.set(name, (byEvent.get(name) || 0) + 1);
      }
    }

    // Sort by count descending, take top 10
    const sorted = Array.from(byEvent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      labels: sorted.map(([label]) => label),
      values: sorted.map(([, count]) => count),
    };
  }

  /**
   * Render all dashboard charts
   * @param {Array} regs - Registration records
   */
  function renderCharts(regs) {
    const registrations = Array.isArray(regs) ? regs : [];

    // Check if Chart.js is loaded
    if (typeof window.Chart === "undefined") {
      console.warn("[overviewCharts] Chart.js not loaded yet");
      return;
    }

    // Check if chart containers exist
    const container = document.getElementById("analytics-charts");
    if (!container) {
      return; // Charts section not in DOM yet
    }

    // Destroy existing charts before re-rendering
    destroyAllCharts();

    // Registration trend (line chart)
    const trendData = computeRegistrationTrend(registrations);
    if (trendData.labels.length > 0) {
      createLineChart(CHART_IDS.registrationTrend, {
        labels: trendData.labels,
        values: trendData.values,
        label: trendData.cumulative ? "Total Registrations" : "Daily Registrations",
      }, {
        title: "Registration Trend",
        color: CHART_COLORS.primary,
        fill: true,
        smooth: true,
      });
    }

    // Revenue breakdown (pie chart)
    const revenueData = computeRevenueBreakdown(registrations);
    if (revenueData.labels.length > 0) {
      createPieChart(CHART_IDS.revenueBreakdown, {
        labels: revenueData.labels,
        values: revenueData.values,
      }, {
        title: "Revenue Breakdown",
        doughnut: true,
        valueFormatter: formatMoney,
      });
    }

    // Age distribution (bar chart)
    const ageData = computeAgeDistribution(registrations);
    if (ageData.labels.length > 0) {
      createBarChart(CHART_IDS.ageDistribution, {
        labels: ageData.labels,
        values: ageData.values,
      }, {
        title: "Registrants by Age Division",
        color: CHART_COLORS.success,
      });
    }

    // Event popularity (horizontal bar chart with labels on bars)
    const eventData = computeEventPopularity(registrations);
    if (eventData.labels.length > 0) {
      createHorizontalBarChart(CHART_IDS.eventPopularity, {
        labels: eventData.labels,
        values: eventData.values,
      }, {
        title: "Event Popularity (Top 10)",
        color: CHART_COLORS.accent,
        labelsOnBars: true,
      });
    }
  }

  /**
   * Clear all charts (e.g., when switching competitions)
   */
  function clearCharts() {
    destroyAllCharts();
  }

  return {
    renderCharts,
    clearCharts,
    CHART_IDS,
  };
}
