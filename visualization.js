import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let selectedRecession = null;
let supersectors = [];
let allMonthly = []; // overall monthly series from viz1_yoy_change.csv

// Per-supersector monthly employment & YoY
let industrySeriesBySupersector = new Map();

/* Helper: year + (month-1)/12 → decimal year */
function ym(year, month) {
  return year + (month - 1) / 12;
}

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Convert decimal t back to "Mon YYYY"
function formatTAsMonthYear(t) {
  const year = Math.floor(t);
  let m = Math.round((t - year) * 12) + 1;
  m = Math.max(1, Math.min(12, m));
  return `${monthNames[m - 1]} ${year}`;
}

/* =======================================
   Load per-supersector monthly employment
   ======================================= */

function loadSupersectorEmployment() {
  const URL = "data/bls_employment_stats.csv";

  return d3.csv(URL).then(raw => {
    const filtered = raw.filter(d => {
      const dt   = (d.data_type_code || "").trim();
      const seas = (d.seasonal || "").trim();
      const val  = +d.value;
      return (dt === "01" || dt === "1") && seas === "S" && !isNaN(val);
    });

    const parsed = filtered.map(d => {
      const month = +d.period.replace("M", "");
      const year  = +d.year;
      const value = +d.value;

      const supersectorCode = (d.supersector_code || "").trim();

      return {
        supersector: supersectorCode,
        year,
        month,
        t: ym(year, month),
        value
      };
    });

    const rolled = d3.rollup(
      parsed,
      v => d3.sum(v, d => d.value),
      d => d.supersector,
      d => `${d.year}-${d.month}`
    );

    const result = new Map();

    for (const [supersector, ymMap] of rolled.entries()) {
      const series = [];

      ymMap.forEach((totalValue, ymKey) => {
        const [yearStr, monthStr] = ymKey.split("-");
        const year = +yearStr;
        const month = +monthStr;
        series.push({
          supersector,
          year,
          month,
          t: ym(year, month),
          value: totalValue
        });
      });

      series.sort((a, b) => d3.ascending(a.t, b.t));

      const byYearMonth = new Map(series.map(d => [`${d.year}-${d.month}`, d]));
      series.forEach(d => {
        const prev = byYearMonth.get(`${d.year - 1}-${d.month}`);
        if (prev && prev.value > 0) {
          d.yoy_change = ((d.value - prev.value) / prev.value) * 100;
        } else {
          d.yoy_change = NaN;
        }
      });

      result.set(supersector, series);
    }

    industrySeriesBySupersector = result;
    return industrySeriesBySupersector;
  });
}

/* ================================
   AND #1: All-industry YoY chart
   ================================ */

function loadViz1() {
  const DATA_URL = "data/viz1_yoy_change.csv";

  d3.csv(DATA_URL).then(raw => {
    const annual = raw.map(d => {
      const value = d.value === "" ? NaN : +d.value;
      const yc = d.yoy_change === "" ? NaN : +d.yoy_change;
      return {
        year: +d.year,
        value,
        yoy_change: yc
      };
    });

    annual.sort((a, b) => d3.ascending(a.year, b.year));

    const monthly = [];

    for (let i = 0; i < annual.length - 1; i++) {
      const a = annual[i];
      const b = annual[i + 1];

      for (let m = 1; m <= 12; m++) {
        const t = ym(a.year, m);
        const alpha = (m - 1) / 12;

        const value = a.value + alpha * (b.value - a.value);

        let yoy;
        if (!isNaN(a.yoy_change) && !isNaN(b.yoy_change)) {
          yoy = a.yoy_change + alpha * (b.yoy_change - a.yoy_change);
        } else {
          yoy = NaN;
        }

        monthly.push({
          year: a.year,
          month: m,
          t,
          value,
          yoy_change: yoy,
          key: `${a.year}-${m}`
        });
      }
    }

    if (annual.length > 0) {
      const last = annual[annual.length - 1];
      for (let m = 1; m <= 12; m++) {
        monthly.push({
          year: last.year,
          month: m,
          t: ym(last.year, m),
          value: last.value,
          yoy_change: last.yoy_change,
          key: `${last.year}-${m}`
        });
      }
    }

    allMonthly = monthly;

    renderViz1(monthly);
    renderAggregateRecessionMiniCharts(monthly);
  });
}

/* ---------- MAIN YOY CHART (same as yours) ---------- */

function renderViz1(data) {
  const margin = { top: 60, right: 40, bottom: 50, left: 70 };
  const width = 1000 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const container = d3.select("#yoy-chart");

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const [minT, maxT] = d3.extent(data, d => d.t);

  const x = d3.scaleLinear()
    .domain([minT, maxT])
    .range([0, width]);

  const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const startYear = Math.ceil(minYear / 5) * 5;
  const endYear = Math.floor(maxYear / 5) * 5;
  const yearTicks = d3.range(startYear, endYear + 1, 5);
  const yearTickPositions = yearTicks.map(y => ym(y, 1));

  const cleanData = data.filter(d => !isNaN(d.yoy_change));

  let y;
  if (cleanData.length) {
    const [minY, maxY] = d3.extent(cleanData, d => d.yoy_change);
    const absMax = Math.max(Math.abs(minY), Math.abs(maxY)) || 1;
    const pad = absMax * 0.05;
    y = d3.scaleLinear()
      .domain([-(absMax + pad), absMax + pad])
      .nice()
      .range([height, 0]);
  } else {
    y = d3.scaleLinear()
      .domain([-10, 10])
      .range([height, 0]);
  }

  const xAxisG = svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`);

  svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y));

  const xGridG = svg.append("g")
    .attr("class", "x-grid")
    .attr("transform", `translate(0,${height})`);

  const yGridTicks = y.ticks(8);

  svg.append("g")
    .attr("class", "y-grid")
    .call(
      d3.axisLeft(y)
        .tickValues(yGridTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  const recessions = [
    {
      id: "2001",
      label: "Dot-com Recession",
      start: ym(2001, 3),
      end: ym(2001, 11),
      startMonth: "Mar"
    },
    {
      id: "2008",
      label: "Great Recession",
      start: ym(2007, 12),
      end: ym(2009, 6),
      startMonth: "Dec"
    },
    {
      id: "2020",
      label: "COVID-19 Recession",
      start: ym(2020, 2),
      end: ym(2020, 4),
      startMonth: "Feb"
    }
  ].map(r => {
    const startYear = Math.floor(r.start);

    const inRange = data.filter(d => d.t >= r.start && d.t <= r.end);
    let jobsLost = null;

    if (inRange.length > 0) {
      const prePoint = data
        .filter(d => d.t < r.start)
        .sort((a, b) => d3.ascending(a.t, b.t))
        .slice(-1)[0];

      const minValue = d3.min(inRange, d => d.value);
      if (prePoint && minValue != null) {
        jobsLost = Math.max(0, prePoint.value - minValue);
      }
    }

    return {
      ...r,
      startYear,
      yearStart: startYear,
      yearEnd: startYear + 2,
      startLabel: `${r.startMonth} ${startYear}`,
      jobsLost
    };
  });

  const recessionById = Object.fromEntries(
    recessions.map(r => [r.id, r])
  );

  const recessionForT = t =>
    recessions.find(r => t >= r.start && t <= r.end) || null;

  const recessionBands = svg.selectAll(".recession-band")
    .data(recessions)
    .enter()
    .append("rect")
    .attr("class", "recession-band")
    .attr("y", 0)
    .attr("height", height)
    .attr("fill", "#d9e2f3")
    .attr("opacity", 0.25);

  const pointData = data.filter(d => !isNaN(d.yoy_change));

  const line = d3.line()
    .defined(d => !isNaN(d.yoy_change))
    .x(d => x(d.t))
    .y(d => y(d.yoy_change))
    .curve(d3.curveLinear);

  const linePath = svg.append("path")
    .attr("class", "yoy-line")
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2);

  let currentData = pointData;

  function updateChart(domain, subset, useMonthTicks) {
    currentData = subset;
    x.domain(domain);

    if (useMonthTicks) {
      const monthTicks = Array.from(
        new Set(subset.map(d => d.t))
      ).sort(d3.ascending);

      const monthAxis = d3.axisBottom(x)
        .tickValues(monthTicks)
        .tickFormat(formatTAsMonthYear);

      xAxisG
        .transition()
        .duration(600)
        .call(monthAxis);

      xGridG
        .transition()
        .duration(600)
        .call(
          d3.axisBottom(x)
            .tickValues(monthTicks)
            .tickSize(-height)
            .tickFormat("")
        );
    } else {
      const filteredYearTicks = yearTickPositions.filter(
        t => t >= domain[0] - 1e-6 && t <= domain[1] + 1e-6
      );

      const yearAxis = d3.axisBottom(x)
        .tickValues(filteredYearTicks)
        .tickFormat(t => d3.format("d")(Math.round(t)));

      xAxisG
        .transition()
        .duration(600)
        .call(yearAxis);

      xGridG
        .transition()
        .duration(600)
        .call(
          d3.axisBottom(x)
            .tickValues(filteredYearTicks)
            .tickSize(-height)
            .tickFormat("")
        );
    }

    recessionBands
      .transition()
      .duration(600)
      .attr("x", d => x(d.start))
      .attr("width", d => x(d.end) - x(d.start));

    linePath
      .datum(subset)
      .transition()
      .duration(600)
      .attr("d", line);

    const dots = svg.selectAll(".dot")
      .data(subset, d => d.key);

    dots.enter()
      .append("circle")
      .attr("class", "dot")
      .attr("r", 3.5)
      .attr("cx", d => x(d.t))
      .attr("cy", d => y(d.yoy_change))
      .merge(dots)
      .transition()
      .duration(600)
      .attr("cx", d => x(d.t))
      .attr("cy", d => y(d.yoy_change));

    dots.exit().remove();
  }

  updateChart([minT, maxT], pointData, false);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -25)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text("Year-over-Year Employment Change (All Industries)");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .attr("class", "chart-caption")
    .text("Monthly line is interpolated from annual data; zoom to see each month in a recession window.");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Month");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Year-over-Year Employment Change (%)");

  svg.append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  const tooltip = d3.select("#tooltip");
  const formatJobs = d3.format(",.0f");

  function updateRecessionSelection() {
    recessionBands
      .classed("selected", d => d.id === selectedRecession)
      .attr("opacity", d => {
        if (!selectedRecession) return 0.25;
        return d.id === selectedRecession ? 0.55 : 0.08;
      });
  }

  recessionBands
    .on("mouseover", (event, d) => {
      let html = `<strong>${d.label}</strong>`;
      if (d.jobsLost != null) {
        const jobsLost = formatJobs(d.jobsLost * 1000);
        html += `<br/>• Jobs lost: ${jobsLost}`;
      }
      html += `<br/>• Start: ${d.startLabel}`;

      tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => {
      if (!selectedRecession) tooltip.style("opacity", 0);
    });

  updateRecessionSelection();

  const focusDot = svg.append("circle")
    .attr("class", "focus-dot")
    .attr("r", 5)
    .style("display", "none");

  svg.append("rect")
    .attr("class", "hover-capture")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);

      if (mx < 0 || mx > width || currentData.length === 0) {
        focusDot.style("display", "none");
        if (!selectedRecession) tooltip.style("opacity", 0);
        return;
      }

      const tAtCursor = x.invert(mx);
      const nearest = currentData.reduce((best, d) => {
        const dist = Math.abs(d.t - tAtCursor);
        return dist < best.dist ? { d, dist } : best;
      }, { d: currentData[0], dist: Infinity }).d;

      if (!nearest) return;

      focusDot
        .style("display", null)
        .attr("cx", x(nearest.t))
        .attr("cy", y(nearest.yoy_change));

      const rec = recessionForT(nearest.t);
      let recHtml = "";
      if (rec) {
        recHtml = `<br/><br/><strong>${rec.label}</strong>`;
        if (rec.jobsLost != null) {
          const jobsLost = formatJobs(rec.jobsLost * 1000);
          recHtml += `<br/>• Jobs lost: ${jobsLost}`;
        }
        recHtml += `<br/>• Start: ${rec.startLabel}`;
      }

      const yoy = isNaN(nearest.yoy_change)
        ? "N/A"
        : nearest.yoy_change.toFixed(1);
      const totalJobs = formatJobs(nearest.value * 1000);
      const monthLabel = `${monthNames[nearest.month - 1]} ${nearest.year}`;

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${monthLabel}</strong>` +
          `<br/>• YoY change: ${yoy}%` +
          `<br/>• Total jobs: ${totalJobs}` +
          recHtml
        )
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => {
      focusDot.style("display", "none");
      if (!selectedRecession) tooltip.style("opacity", 0);
    });

  function zoomToRecession(id) {
    let newDomain;
    let subset;
    let useMonthTicks;

    if (!id) {
      newDomain = [minT, maxT];
      subset = pointData;
      useMonthTicks = false;
    } else {
      const r = recessionById[id];
      subset = pointData.filter(d => d.t >= r.start && d.t <= r.end);

      if (subset.length === 0) {
        newDomain = [minT, maxT];
        subset = pointData;
        useMonthTicks = false;
      } else {
        newDomain = [r.start, r.end];
        useMonthTicks = true;
      }
    }

    updateChart(newDomain, subset, useMonthTicks);

    recessionBands
      .classed("selected", d => d.id === id);
  }

  d3.selectAll("#recession-choice button")
    .on("click", function () {
      const id = this.dataset.rec;
      selectedRecession = (selectedRecession === id ? null : id);

      d3.selectAll("#recession-choice button")
        .classed("active", function () {
          return this.dataset.rec === selectedRecession;
        });

      zoomToRecession(selectedRecession);
      updateRecessionSelection();
    });
}

/* ==========================================
   AND SECTION MINI CHARTS (all-industry)
   ========================================== */
/* ==========================================
   AND SECTION MINI CHARTS
   (all-industry YoY during each recession)
   ========================================== */

function renderAggregateRecessionMiniCharts(data) {
  const container = d3.select("#recession-mini-charts");
  if (container.empty()) return;

  container.selectAll("*").remove();

  const containerNode = container.node();
  const availableWidth = containerNode
    ? containerNode.getBoundingClientRect().width
    : 900;

  const maxRowWidth = Math.min(availableWidth, 900);
  const gapPx = 24;
  let cardOuterWidth = Math.floor((maxRowWidth - 2 * gapPx) / 3);
  cardOuterWidth = Math.max(220, cardOuterWidth);
  const cardOuterHeight = 210;

  const recessions = [
    {
      id: "2001",
      label: "2001: Dot-com Recession",
      startYear: 2001, startMonth: 3,
      endYear: 2001, endMonth: 11
    },
    {
      id: "2008",
      label: "2008–2009: Great Recession",
      startYear: 2007, startMonth: 12,
      endYear: 2009, endMonth: 6
    },
    {
      id: "2020",
      label: "2020: COVID-19 Shock",
      startYear: 2020, startMonth: 2,
      endYear: 2020, endMonth: 4
    }
  ];

  // Shared y-domain across all recessions (all industries)
  const recessionYs = [];
  recessions.forEach(rec => {
    const startT = ym(rec.startYear, rec.startMonth);
    const endT   = ym(rec.endYear, rec.endMonth);
    data.forEach(d => {
      if (d.t >= startT && d.t <= endT && !isNaN(d.yoy_change)) {
        recessionYs.push(d.yoy_change);
      }
    });
  });

  let yDomain;
  if (recessionYs.length) {
    const [minY, maxY] = d3.extent(recessionYs);
    let absMax = Math.max(Math.abs(minY), Math.abs(maxY)) || 1;
    absMax = Math.min(absMax, 25); // cap extremes
    const pad = absMax * 0.05;
    yDomain = [-(absMax + pad), absMax + pad];
  } else {
    yDomain = [-10, 10];
  }

  const wrapper = container.append("div")
    .attr("class", "and-mini-chart-wrapper")
    .style("display", "flex")
    .style("flex-direction", "row")
    .style("gap", "1.5rem")
    .style("align-items", "flex-start")
    .style("justify-content", "center")
    .style("flex-wrap", "nowrap")
    .style("overflow-x", "auto")
    .style("margin-top", "1.5rem");

  recessions.forEach(rec => {
    const startT = ym(rec.startYear, rec.startMonth);
    const endT   = ym(rec.endYear, rec.endMonth);

    const series = data
      .filter(d => d.t >= startT && d.t <= endT && !isNaN(d.yoy_change))
      .sort((a, b) => d3.ascending(a.t, b.t));

    const card = wrapper.append("div")
      .attr("class", "and-mini-chart-card")
      .style("flex", `0 0 ${cardOuterWidth}px`)
      .style("width", `${cardOuterWidth}px`);

    card.append("h4")
      .attr("class", "and-mini-chart-title")
      .style("text-align", "center")
      .style("margin-bottom", "0.25rem")
      .text(rec.label);

    const margin = { top: 18, right: 12, bottom: 36, left: 45 };
    const width  = cardOuterWidth  - margin.left - margin.right;
    const height = cardOuterHeight - margin.top  - margin.bottom;

    const svg = card.append("svg")
      .attr("width", cardOuterWidth)
      .attr("height", cardOuterHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    if (series.length === 0) {
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("class", "no-data-label")
        .text("No data for this period.");
      return;
    }

    const x = d3.scaleLinear()
      .domain([startT, endT])
      .range([0, width]);

    // 🔑 Clamp y so lines never leave the chart box
    const y = d3.scaleLinear()
      .domain(yDomain)
      .range([height, 0])
      .clamp(true);

    svg.append("line")
      .attr("class", "zero-line-mini")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#aaa")
      .attr("stroke-width", 1);

    const line = d3.line()
      .defined(d => !isNaN(d.yoy_change))
      .x(d => x(d.t))
      .y(d => y(d.yoy_change))
      .curve(rec.id === "2020" ? d3.curveLinear : d3.curveMonotoneX);

    svg.append("path")
      .datum(series)
      .attr("class", "and-mini-line")
      .attr("fill", "none")
      .attr("stroke", "#0077cc")
      .attr("stroke-width", 2)
      .attr("d", line);

    const uniqueTs = [...new Set(series.map(d => d.t))].sort(d3.ascending);
    let tickValues;
    if (uniqueTs.length <= 8) {
      tickValues = uniqueTs;
    } else {
      const step = Math.ceil(uniqueTs.length / 6);
      tickValues = uniqueTs.filter((_, i) => i % step === 0);
    }

    const xAxis = d3.axisBottom(x)
      .tickValues(tickValues)
      .tickFormat(formatTAsMonthYear)
      .tickSize(0);

    svg.append("g")
      .attr("class", "and-mini-x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "8px")
      .style("text-anchor", "end")
      .attr("dx", "0.75em")
      .attr("dy", "1.1em");

    svg.append("g")
      .attr("class", "and-mini-y-axis")
      .call(d3.axisLeft(y).ticks(4))
      .selectAll("text")
      .style("font-size", "8px");

    svg.append("text")
      .attr("class", "and-mini-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 28)
      .attr("text-anchor", "middle")
      .style("font-size", "9px")
      .text("Month");

    svg.append("text")
      .attr("class", "and-mini-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -36)
      .attr("text-anchor", "middle")
      .style("font-size", "9px")
      .text("YoY Employment Change (%)");
  });
}


/* ==========================================
   BUT #2: Industry mini charts
   ========================================== */

function renderIndustryRecessionCharts(supersectorName, data) {
  const container = d3.select("#industry-normalized-viz");
  if (container.empty()) return;

  container.classed("viz-placeholder", false);
  container.selectAll("*").remove();

  if (!data || !data.length) {
    container.append("p")
      .style("font-style", "italic")
      .text("No data available for this industry.");
    return;
  }

  container.append("h3")
    .style("margin-bottom", "0.5rem")
    .style("font-size", "1.1rem")
    .text(`${supersectorName}: Year-over-Year Employment Change in Each Recession`);

  const containerNode = container.node();
  const availableWidth = containerNode
    ? containerNode.getBoundingClientRect().width
    : 900;

  const maxRowWidth = Math.min(availableWidth, 900);
  const gapPx = 24;
  let cardOuterWidth = Math.floor((maxRowWidth - 2 * gapPx) / 3);
  cardOuterWidth = Math.max(220, cardOuterWidth);
  const cardOuterHeight = 210;

  const recessions = [
    {
      id: "2001",
      label: "2001: Dot-com Recession",
      startYear: 2001, startMonth: 3,
      endYear: 2001, endMonth: 11
    },
    {
      id: "2008",
      label: "2008–2009: Great Recession",
      startYear: 2007, startMonth: 12,
      endYear: 2009, endMonth: 6
    },
    {
      id: "2020",
      label: "2020: COVID-19 Shock",
      startYear: 2020, startMonth: 2,
      endYear: 2020, endMonth: 4
    }
  ];

  // Shared y-domain across all three recessions for THIS industry
  const recessionYs = [];
  recessions.forEach(rec => {
    const startT = ym(rec.startYear, rec.startMonth);
    const endT   = ym(rec.endYear, rec.endMonth);
    data.forEach(d => {
      if (d.t >= startT && d.t <= endT && !isNaN(d.yoy_change)) {
        recessionYs.push(d.yoy_change);
      }
    });
  });

  let yDomain;
  if (recessionYs.length) {
    const [minY, maxY] = d3.extent(recessionYs);
    let absMax = Math.max(Math.abs(minY), Math.abs(maxY)) || 1;
    absMax = Math.min(absMax, 25);
    const pad = absMax * 0.05;
    yDomain = [-(absMax + pad), absMax + pad];
  } else {
    yDomain = [-10, 10];
  }

  const wrapper = container.append("div")
    .attr("class", "mini-chart-wrapper")
    .style("display", "flex")
    .style("flex-direction", "row")
    .style("gap", "1.5rem")
    .style("align-items", "flex-start")
    .style("justify-content", "center")
    .style("flex-wrap", "nowrap")
    .style("overflow-x", "auto")
    .style("padding-bottom", "0.5rem");

  recessions.forEach(rec => {
    const startT = ym(rec.startYear, rec.startMonth);
    const endT   = ym(rec.endYear, rec.endMonth);

    const series = data
      .filter(d => d.t >= startT && d.t <= endT && !isNaN(d.yoy_change))
      .sort((a, b) => d3.ascending(a.t, b.t));

    const card = wrapper.append("div")
      .attr("class", "mini-chart-card")
      .style("flex", `0 0 ${cardOuterWidth}px`)
      .style("width", `${cardOuterWidth}px`);

    card.append("h4")
      .attr("class", "mini-chart-title")
      .style("text-align", "center")
      .text(rec.label);

    const margin = { top: 20, right: 16, bottom: 40, left: 55 };
    const width  = cardOuterWidth  - margin.left - margin.right;
    const height = cardOuterHeight - margin.top  - margin.bottom;

    const svg = card.append("svg")
      .attr("width", cardOuterWidth)
      .attr("height", cardOuterHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    if (series.length === 0) {
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("class", "no-data-label")
        .text("No data for this period.");
      return;
    }

    const x = d3.scaleLinear()
      .domain([startT, endT])
      .range([0, width]);

    // 🔑 Clamp y here too so COVID lines stay inside the axes
    const y = d3.scaleLinear()
      .domain(yDomain)
      .range([height, 0])
      .clamp(true);

    svg.append("line")
      .attr("class", "zero-line-mini")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#aaa")
      .attr("stroke-width", 1);

    const line = d3.line()
      .defined(d => !isNaN(d.yoy_change))
      .x(d => x(d.t))
      .y(d => y(d.yoy_change))
      .curve(rec.id === "2020" ? d3.curveLinear : d3.curveMonotoneX);

    svg.append("path")
      .datum(series)
      .attr("class", "mini-line")
      .attr("fill", "none")
      .attr("stroke", "#2676c8")
      .attr("stroke-width", 2)
      .attr("d", line);

    const uniqueTs = [...new Set(series.map(d => d.t))].sort(d3.ascending);
    let tickValues;
    if (uniqueTs.length <= 8) {
      tickValues = uniqueTs;
    } else {
      const step = Math.ceil(uniqueTs.length / 6);
      tickValues = uniqueTs.filter((_, i) => i % step === 0);
    }

    const xAxis = d3.axisBottom(x)
      .tickValues(tickValues)
      .tickFormat(formatTAsMonthYear)
      .tickSize(0);

    svg.append("g")
      .attr("class", "mini-x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "8px")
      .style("text-anchor", "end")
      .attr("dx", "0.75em")
      .attr("dy", "1.1em");

    svg.append("g")
      .attr("class", "mini-y-axis")
      .call(d3.axisLeft(y).ticks(4))
      .selectAll("text")
      .style("font-size", "8px");

    svg.append("text")
      .attr("class", "mini-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 30)
      .attr("text-anchor", "middle")
      .style("font-size", "9px")
      .text("Month");

    svg.append("text")
      .attr("class", "mini-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .text("Year-over-Year Employment Change (%)");
  });
}

/* ======================================
   Supersectors + buttons
   ====================================== */

function loadSupersectors() {
  const URL = "data/ce.supersector.txt"; // tab-delimited
  return d3.tsv(URL).then(raw => {
    supersectors = raw.map(d => ({
      code: d.supersector_code,
      name: d.supersector_name
    }));
    return supersectors;
  });
}

function initIndustryButtons() {
  const grid = d3.select("#industry-grid");
  grid.selectAll("*").remove();

  const buttons = grid.selectAll("button")
    .data(supersectors)
    .enter()
    .append("button")
    .attr("class", "industry-button")
    .attr("data-supersector", d => d.code)
    .text(d => d.name)
    .on("click", (event, d) => {
      grid.selectAll("button").classed("active", false);
      d3.select(event.currentTarget).classed("active", true);
      handleIndustrySelect(d.code, d.name);
    });

  // AUTO-SELECT THE FIRST INDUSTRY so mini charts appear immediately
  const firstBtn = buttons.node();
  if (firstBtn) {
    const d = d3.select(firstBtn).datum();
    d3.select(firstBtn).classed("active", true);
    handleIndustrySelect(d.code, d.name);
  }
}

function handleIndustrySelect(supersectorCode, supersectorName) {
  const series = industrySeriesBySupersector.get(supersectorCode);
  renderIndustryRecessionCharts(supersectorName, series || []);
}

/* ---------- Init ---------- */

loadViz1();

Promise.all([
  loadSupersectors(),
  loadSupersectorEmployment()
]).then(() => {
  initIndustryButtons();
});


















