import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ------------------------
// State for frame 4
// ------------------------
let viz3And4Rows = [];
let selectedIndustryFrame4 = null;
let dataLoaded = false;

const RECESSION_BASELINES = {
  "2001": { id: "2001", label: "2001", year: 2001, month: 1 },
  "2008": { id: "2008", label: "2008", year: 2007, month: 11 },
  "2020": { id: "2020", label: "2020", year: 2020, month: 1 }
};

const RECESSION_COLORS = {
  "2001": "#e41a1c",
  "2008": "#377eb8",
  "2020": "#4daf4a"
};

function normalizeName(str) {
  return String(str)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const INDUSTRY_ALIASES = {
  "professional services": "Professional and business services"
};

// ------------------------
// Data loading
// ------------------------
function loadShockRecoveryData() {
  d3.csv("data/viz3_and4.csv").then(raw => {
    viz3And4Rows = raw.map(d => ({
      ...d,
      supersector_name: d.supersector_name,
      year: +d.year,
      month_num: +d.month_num,
      value: +d.value,
      t_global: +d.t_global
    }));
    dataLoaded = true;
    updateShockRecoveryChart();
    updateLandingBarChart();
  }).catch(err => {
    console.error("Error loading viz3_and4.csv", err);
  });
}

// ------------------------
// Build indexed series
// ------------------------
function buildRecessionSeriesForIndustry(industryName) {
  if (!dataLoaded || !viz3And4Rows.length || !industryName) return [];

  const normTarget = normalizeName(industryName);
  const aliasName = INDUSTRY_ALIASES[normTarget] || industryName;
  const effectiveNormTarget = normalizeName(aliasName);

  const rows = viz3And4Rows
    .filter(d => {
      const nameNorm = normalizeName(d.supersector_name);
      return (
        nameNorm === effectiveNormTarget ||
        nameNorm.includes(effectiveNormTarget) ||
        effectiveNormTarget.includes(nameNorm)
      );
    })
    .sort((a, b) => d3.ascending(a.t_global, b.t_global));

  if (!rows.length) return [];

  const allSeries = [];

  for (const [id, def] of Object.entries(RECESSION_BASELINES)) {
    const baselineT = def.year * 12 + def.month;

    const seg = rows
      .filter(d => d.t_global >= baselineT - 1 && d.t_global <= baselineT + 24)
      .sort((a, b) => d3.ascending(a.t_global, b.t_global));

    if (!seg.length) continue;

    const values = seg.map(d => d.value);

    // simple 2‑month smoothing (approx of your rolling mean)
    const smoothedFull = values.map((v, i) => {
      const prev = i > 0 ? values[i - 1] : v;
      return (prev + v) / 2;
    });
    // Limit to first 25 points so monthsAfterStart runs 0–24
    const maxPoints = 25;
    const smoothed = smoothedFull.slice(0, maxPoints);

    const base = smoothed[0];
    if (!base || !isFinite(base)) continue;

    const series = smoothed.map((v, i) => ({
      recessionId: id,
      label: def.label,
      monthAfterStart: i,     // 0..24
      index: (v / base) * 100
    }));

    allSeries.push(series);
  }

  return allSeries;
}

// ------------------------
// Rendering
// ------------------------
function updateShockRecoveryChart() {
  const container = d3.select("#industry-recession-chart");
  if (container.empty()) return;

  container.selectAll("*").remove();

  if (!selectedIndustryFrame4) {
    container
      .append("p")
      .text("Choose an industry in the previous frame to see its shock-and-recovery paths here.");
    return;
  }

  if (!dataLoaded) {
    container.append("p").text("Loading employment data…");
    return;
  }

  const seriesByRec = buildRecessionSeriesForIndustry(selectedIndustryFrame4);
  if (!seriesByRec.length) {
    container
      .append("p")
      .text(`No data available for ${selectedIndustryFrame4}.`);
    return;
  }

  const margin = { top: 60, right: 40, bottom: 50, left: 80 };
  const width = 900 - margin.left - margin.right;
  const height = 450 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const allPoints = seriesByRec.flat();

  const x = d3.scaleLinear()
    .domain([0, 24])
    .range([0, width]);

  const [yMinRaw, yMaxRaw] = d3.extent(allPoints, d => d.index);
  const pad = 5;
  const y = d3.scaleLinear()
    .domain([yMinRaw - pad, yMaxRaw + pad])
    .range([height, 0]);

  // grid
  const xTicks = d3.range(0, 25, 6);
  const yTicks = d3.ticks(y.domain()[0], y.domain()[1], 8);

  svg.append("g")
    .attr("class", "x-grid")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(xTicks)
        .tickSize(-height)
        .tickFormat("")
    );

  svg.append("g")
    .attr("class", "y-grid")
    .call(
      d3.axisLeft(y)
        .tickValues(yTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickValues(xTicks));

  svg.append("g").call(d3.axisLeft(y));

  // zero line at 100
  svg.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(100))
    .attr("y2", y(100))
    .attr("stroke", "#000")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "2,2");

  // title / labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -25)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text(`${selectedIndustryFrame4}: Shock & Recovery`);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Months After Start");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -55)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Employment Index (Start = 100)");

  // line generator
  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.monthAfterStart))
    .y(d => y(d.index));

  // lines + trough dots/labels
  seriesByRec.forEach(series => {
    const recId = series[0].recessionId;
    const color = RECESSION_COLORS[recId] || "#333";

    svg.append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 3)
      .attr("d", line);

    // trough
    // Find trough only within visible 0–24 month window
    const visibleSeries = series.filter(d => d.monthAfterStart <= 24);
    const trough = d3.least(visibleSeries, d => d.index);
    if (!trough) return;

    const loss = 100 - trough.index;

    // Clamp label position so it stays inside chart horizontally
    const clamp = (val, min, max) =>
      Math.max(min, Math.min(max, val));

    const xPos = clamp(x(trough.monthAfterStart), 0, width);
    const yPosDot = y(trough.index);

    svg.append("circle")
      .attr("cx", x(trough.monthAfterStart))
      .attr("cy", yPosDot)
      .attr("r", 4)
      .attr("fill", "black");

    const yPosLabel = clamp(yPosDot + 16, 10, height - 5);

    svg.append("text")
      .attr("x", xPos)
      .attr("y", yPosLabel)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .text(
        `${recId} low: ${trough.index.toFixed(1)} (${Math.abs(loss).toFixed(1)}% job loss)`
      );
  });

  // legend
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 120}, 5)`);

  const legendItems = Object.keys(RECESSION_BASELINES);

  legendItems.forEach((id, i) => {
    const g = legend.append("g")
      .attr("transform", `translate(0, ${i * 22})`);

    g.append("line")
      .attr("x1", 0)
      .attr("x2", 24)
      .attr("y1", 8)
      .attr("y2", 8)
      .attr("stroke", RECESSION_COLORS[id])
      .attr("stroke-width", 3);

    g.append("text")
      .attr("x", 30)
      .attr("y", 10)
      .attr("font-size", 12)
      .text(id);
  });
}

// ------------------------
// Frame 5: 2-years-later bar chart
// ------------------------
const LANDING_LABELS = [
  "2001 Dot-com",
  "2008 Great Recession",
  "2020 Covid-19"
];

const LABEL_TO_REC_ID = {
  "2001 Dot-com": "2001",
  "2008 Great Recession": "2008",
  "2020 Covid-19": "2020"
};

function computeLandingMetricsForIndustry(industryName) {
  const seriesByRec = buildRecessionSeriesForIndustry(industryName);
  if (!seriesByRec.length) return {};

  const fmtMonth = d3.timeFormat("%b %Y");
  const metrics = {};

  LANDING_LABELS.forEach(label => {
    const recId = LABEL_TO_REC_ID[label];
    const series = seriesByRec.find(s => s[0].recessionId === recId);
    if (!series || !series.length) {
      metrics[label] = null;
      return;
    }

    const landingPoint = series[Math.min(24, series.length - 1)];
    const landingIndex = landingPoint.index;
    const deltaTwoYears = landingIndex - 100;

    const trough = d3.least(series, d => d.index);
    let lowestMonthLabel = null;
    let jobLossLowest = null;

    if (trough) {
      const def = RECESSION_BASELINES[recId];
      const startYear = def.year;
      const startMonth = def.month;
      let totalMonths = startMonth - 1 + trough.monthAfterStart;
      const year = startYear + Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      const dt = new Date(year, month - 1, 1);
      lowestMonthLabel = fmtMonth(dt);
      jobLossLowest = trough.index - 100;
    }

    metrics[label] = {
      deltaTwoYears,
      lowestMonth: lowestMonthLabel,
      jobLossLowest
    };
  });

  return metrics;
}

function updateLandingBarChart() {
  const container = d3.select("#industry-landing-chart");
  if (container.empty()) return;

  container.selectAll("*").remove();

  if (!selectedIndustryFrame4) {
    container
      .append("p")
      .text("Choose an industry earlier to see how it fared two years after each recession.");
    return;
  }

  if (!dataLoaded) {
    container.append("p").text("Loading employment data…");
    return;
  }

  const metricsByLabel = computeLandingMetricsForIndustry(
    selectedIndustryFrame4
  );

  const heights = LANDING_LABELS.map(label => {
    const m = metricsByLabel[label];
    return m && typeof m.deltaTwoYears === "number" ? m.deltaTwoYears : null;
  });

  if (heights.every(h => h == null)) {
    container
      .append("p")
      .text(`No data available for ${selectedIndustryFrame4}.`);
    return;
  }

  const margin = { top: 60, right: 40, bottom: 90, left: 80 };
  const width = 900 - margin.left - margin.right;
  const height = 450 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(LANDING_LABELS)
    .range([0, width])
    .padding(0.3);

  const numericHeights = heights.filter(h => h != null).concat([0]);
  const [yMinRaw, yMaxRaw] = d3.extent(numericHeights);
  const pad = (yMaxRaw - yMinRaw || 1) * 0.1;

  const y = d3
    .scaleLinear()
    .domain([Math.min(yMinRaw, 0) - pad, Math.max(yMaxRaw, 0) + pad])
    .range([height, 0]);

  const yTicks = d3.ticks(y.domain()[0], y.domain()[1], 6);

  svg
    .append("g")
    .attr("class", "y-grid")
    .call(
      d3
        .axisLeft(y)
        .tickValues(yTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  svg.append("g").call(d3.axisLeft(y));

  svg
    .append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "#000")
    .attr("stroke-width", 1);

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -25)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text(`${selectedIndustryFrame4}: 2 Years Later`);

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Recession");

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -55)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Jobs change after 2 years (%)");

  svg
    .selectAll(".bar")
    .data(LANDING_LABELS)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d))
    .attr("width", x.bandwidth())
    .attr("y", d => {
      const h = metricsByLabel[d]?.deltaTwoYears ?? 0;
      return h >= 0 ? y(h) : y(0);
    })
    .attr("height", d => {
      const h = metricsByLabel[d]?.deltaTwoYears ?? 0;
      return Math.abs(y(h) - y(0));
    })
    .attr("fill", d => {
      const recId = LABEL_TO_REC_ID[d];
      return RECESSION_COLORS[recId] || "#666";
    });

  svg
    .selectAll(".bar-label")
    .data(LANDING_LABELS)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d) + x.bandwidth() / 2)
    .attr("y", d => {
      const h = metricsByLabel[d]?.deltaTwoYears ?? 0;
      return h >= 0 ? y(h) - 5 : y(h) + 15;
    })
    .attr("text-anchor", "middle")
    .attr("font-size", 16)
    .attr("font-weight", "bold")
    .text(d => {
      const h = metricsByLabel[d]?.deltaTwoYears;
      return typeof h === "number" ? `${h >= 0 ? "+" : ""}${h.toFixed(1)}%` : "";
    });

  const infoGroup = svg.append("g").attr("class", "bar-info");

  LANDING_LABELS.forEach(label => {
    const m = metricsByLabel[label];
    const cx = x(label) + x.bandwidth() / 2;

    if (!m || !m.lowestMonth || m.jobLossLowest == null) {
      infoGroup
        .append("text")
        .attr("x", cx)
        .attr("y", height + 58)
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .text("No data");
      return;
    }

    infoGroup
      .append("text")
      .attr("x", cx)
      .attr("y", height + 58)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .text(`Lowest month: ${m.lowestMonth}`);

    infoGroup
      .append("text")
      .attr("x", cx)
      .attr("y", height + 75)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .text(
        `Job loss for worst month: ${m.jobLossLowest.toFixed(1)}%`
      );
  });
}
// ------------------------
// Wiring to frame‑3 buttons
// ------------------------
function initIndustrySelectionHook() {
  const buttons = document.querySelectorAll(".industry-btn");
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const keyFromData = btn.dataset.sector;
      selectedIndustryFrame4 = keyFromData && keyFromData.trim().length > 0
        ? keyFromData.trim()
        : btn.textContent.trim();

      updateShockRecoveryChart();
      updateLandingBarChart();
    });
  });
}

// ------------------------
// Init
// ------------------------
window.addEventListener("DOMContentLoaded", () => {
  initIndustrySelectionHook();
  loadShockRecoveryData();
});
