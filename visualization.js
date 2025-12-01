import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------------------------------------------
// Global state
// ---------------------------------------------
let selectedRecession = null;

// For the story we keep both a key (CSV name) and label (button text)
let selectedIndustryKey = null;   // matches CSV "industry" column
let selectedIndustryLabel = "";   // nice label shown in UI

// Entire YoY dataset (overall, from viz1_yoy_change.csv)
let yoyData = [];

// Per-industry monthly YoY (from industry_yoy.csv)
let industrySeriesByName = new Map();

// ---------------------------------------------
// Recovery windows (with year+month bounds)
// ---------------------------------------------
const recoveryWindows = {
  "2001": {
    id: "2001",
    label: "Dot-com Recession Recovery",
    startYear: 2001,
    startMonth: 12,
    endYear: 2005,
    endMonth: 1,
    startLabel: "Dec 2001",
    endLabel: "Jan 2005"
  },
  "2008": {
    id: "2008",
    label: "Great Recession Recovery",
    startYear: 2009,
    startMonth: 6,
    endYear: 2013,
    endMonth: 3,
    startLabel: "Jun 2009",
    endLabel: "Mar 2013"
  },
  "2020": {
    id: "2020",
    label: "COVID-19 Recession Recovery",
    startYear: 2020,
    startMonth: 5,
    endYear: 2022,
    endMonth: 4,
    startLabel: "May 2020",
    endLabel: "Apr 2022"
  }
};

// ---------------------------------------------
// Load data: overall YoY + per-industry monthly YoY
// ---------------------------------------------
function loadViz1() {
  const OVERALL_URL = "data/viz1_yoy_change.csv";
  const INDUSTRY_URL = "data/industry_yoy.csv";

  Promise.all([
    d3.csv(OVERALL_URL, d => ({
      year: +d.year,
      value: +d.value,
      yoy_change: d.yoy_change === "" ? NaN : +d.yoy_change
    })),
    d3.csv(INDUSTRY_URL, d => ({
      series_id: d.series_id,
      industry: d.industry,
      supersector_code: d.supersector_code,
      date: d.date,
      year: +d.year,
      month: +d.month,
      value: +d.value,
      yoy_change: d.yoy_change === "" ? NaN : +d.yoy_change
    }))
  ]).then(([overall, industryRows]) => {
    // Overall series (annual YoY) – used for Frame 1
    yoyData = overall;

    // Per-industry monthly series – used for "Your Industry's Story"
    const cleanIndustryRows = industryRows.filter(
      d => !isNaN(d.year) && !isNaN(d.month) && !isNaN(d.yoy_change)
    );

    // Group by industry name (must match the CSV's "industry" values)
    industrySeriesByName = d3.group(cleanIndustryRows, d => d.industry);

    renderViz1(overall);
    initIndustryButtons();
    initRecoveryButtons();
  });
}

// ---------------------------------------------
// Frame 1: Big YoY Employment Visualization
// (unchanged logic from your version)
// ---------------------------------------------
function renderViz1(data) {
  const margin = { top: 60, right: 40, bottom: 50, left: 70 };
  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const container = d3.select("#yoy-chart");
  const recButtons = document.querySelectorAll("#recession-choice button");
  const infoBox = document.getElementById("rec-info-box");

  function fillInfoBox(rec) {
    if (!rec) {
      infoBox.style.display = "none";
      return;
    }

    let html = `
      <strong>${rec.label}</strong><br>
      Start: ${rec.startLabel}<br>
    `;

    if (rec.jobsLost != null) {
      html += `Jobs lost: ${d3.format(",.0f")(rec.jobsLost * 1000)}`;
    }

    infoBox.innerHTML = html;
    infoBox.style.display = "block";
  }

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#tooltip");

  function tooltipPos(event) {
    const box = container.node().getBoundingClientRect();
    return {
      x: event.clientX - box.left,
      y: event.clientY - box.top
    };
  }

  const formatJobs = d3.format(",.0f");
  const [minYear, maxYear] = d3.extent(data, d => d.year);
  const x = d3.scaleLinear().domain([minYear, maxYear]).range([0, width]);

  const startYear = Math.ceil(minYear / 5) * 5;
  const endYear = Math.floor(maxYear / 5) * 5;
  const yearTicks = d3.range(startYear, endYear + 1, 5);

  const y = d3.scaleLinear().domain([-7, 5]).range([height, 0]);

  // Build recession metadata using overall series
  const recessions = [
    {
      id: "2001",
      label: "Dot-com Recession",
      start: 2001.25,
      end: 2003.25,
      startMonth: "Mar"
    },
    {
      id: "2008",
      label: "Great Recession",
      start: 2008.0,
      end: 2010.0,
      startMonth: "Jan"
    },
    {
      id: "2020",
      label: "COVID-19 Recession",
      start: 2020.2,
      end: 2022.2,
      startMonth: "Mar"
    }
  ].map(r => {
    const sYear = Math.floor(r.start);
    const yearStart = sYear;
    const yearEnd = sYear + 2;

    const inRange = data.filter(d => d.year >= yearStart && d.year <= yearEnd);

    let jobsLost = null;
    if (inRange.length > 0) {
      const prePoint = data.find(d => d.year === yearStart - 1);
      const minValue = d3.min(inRange, d => d.value);
      if (prePoint && minValue != null) {
        jobsLost = Math.max(0, prePoint.value - minValue);
      }
    }

    return {
      ...r,
      startYear: sYear,
      yearStart,
      yearEnd,
      startLabel: `${r.startMonth} ${sYear}`,
      jobsLost
    };
  });

  const recessionForYear = year =>
    recessions.find(r => year >= r.yearStart && year <= r.yearEnd) || null;

  // Shaded recession bands
  const recessionBands = svg
    .selectAll(".recession-band")
    .data(recessions)
    .enter()
    .append("rect")
    .attr("class", "recession-band")
    .attr("x", d => x(d.start))
    .attr("width", d => x(d.end) - x(d.start))
    .attr("y", 0)
    .attr("height", height);

  // Gridlines
  svg
    .append("g")
    .attr("class", "x-grid")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(yearTicks)
        .tickSize(-height)
        .tickFormat("")
    );

  const yGridTicks = d3.range(-7, 5 + 1, 1);

  svg
    .append("g")
    .attr("class", "y-grid")
    .call(
      d3
        .axisLeft(y)
        .tickValues(yGridTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  // Main line
  const line = d3
    .line()
    .curve(d3.curveMonotoneX)
    .defined(d => !isNaN(d.yoy_change))
    .x(d => x(d.year))
    .y(d => y(d.yoy_change));

  svg
    .append("path")
    .datum(data)
    .attr("class", "yoy-line")
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickValues(yearTicks).tickFormat(d3.format("d")));

  svg.append("g").call(d3.axisLeft(y).tickValues(yGridTicks));

  // Titles & labels
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -25)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text("Year-over-Year Employment Change (All Industries)");

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .attr("class", "chart-caption")
    .text(
      "Shaded areas mark recession periods starting at the downturn month and the two years that follow."
    );

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Year");

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("YoY Change (%)");

  // Zero line
  svg
    .append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  // Recession band interactions
  const updateRecessionSelection = () => {
    recessionBands.classed("selected", d => d.id === selectedRecession);
  };

  recessionBands
    .on("mouseover", (event, d) => {
      let html = `<strong>${d.label}</strong>`;
      if (d.jobsLost != null) {
        const jobsLost = formatJobs(d.jobsLost * 1000);
        html += `<br/>• Jobs lost: ${jobsLost}`;
      }
      html += `<br/>• Start: ${d.startLabel}`;

      const pos = tooltipPos(event);

      tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", pos.x + 15 + "px")
        .style("top", pos.y - 20 + "px");
    })
    .on("mouseout", () => {
      if (!selectedRecession) tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      selectedRecession = selectedRecession === d.id ? null : d.id;
      updateRecessionSelection();
      updateIndustryStory();
      if (!selectedRecession) tooltip.style("opacity", 0);
    });

  // Frame-1 recession buttons
  recButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const recId = btn.dataset.rec;

      selectedRecession = selectedRecession === recId ? null : recId;

      recButtons.forEach(b => b.classList.remove("selected"));
      if (selectedRecession) btn.classList.add("selected");

      const rec = recessions.find(r => r.id === selectedRecession);
      fillInfoBox(rec);

      updateRecessionSelection();
      updateIndustryStory();
    });
  });

  updateRecessionSelection();

  // Hover dots
  const pointData = data.filter(d => !isNaN(d.yoy_change));

  const focusDot = svg
    .append("circle")
    .attr("class", "focus-dot")
    .attr("r", 5)
    .style("display", "none");

  svg
    .append("rect")
    .attr("class", "hover-capture")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("mousemove", event => {
      const [mx] = d3.pointer(event);

      if (mx < 0 || mx > width) {
        focusDot.style("display", "none");
        if (!selectedRecession) tooltip.style("opacity", 0);
        return;
      }

      const yearAtCursor = x.invert(mx);

      const nearest = pointData.reduce(
        (best, d) => {
          const dist = Math.abs(d.year - yearAtCursor);
          return dist < best.dist ? { d, dist } : best;
        },
        { d: pointData[0], dist: Infinity }
      ).d;

      if (!nearest) return;

      focusDot
        .style("display", null)
        .attr("cx", x(nearest.year))
        .attr("cy", y(nearest.yoy_change));

      const rec = recessionForYear(nearest.year);

      let recHtml = "";
      if (rec) {
        recHtml = `<br/><br/><strong>${rec.label}</strong>`;
        if (rec.jobsLost != null) {
          const jobsLost = formatJobs(rec.jobsLost * 1000);
          recHtml += `<br/>• Jobs lost: ${jobsLost}`;
        }
        recHtml += `<br/>• Start: ${rec.startLabel}`;
      }

      const yoyVal = nearest.yoy_change.toFixed(1);
      const totalJobs = formatJobs(nearest.value * 1000);

      const pos = tooltipPos(event);

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${nearest.year}</strong>` +
            `<br/>• YoY change: ${yoyVal}%` +
            `<br/>• Total jobs: ${totalJobs}` +
            recHtml
        )
        .style("left", pos.x + 15 + "px")
        .style("top", pos.y - 20 + "px");
    })
    .on("mouseout", () => {
      focusDot.style("display", "none");
      if (!selectedRecession) tooltip.style("opacity", 0);
    });
}

// ---------------------------------------------
// Frame 2: Industry buttons
// ---------------------------------------------
function initIndustryButtons() {
  const buttons = document.querySelectorAll(".industry-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      // CSV key comes from data-sector (e.g., "Durable Goods")
      selectedIndustryKey = btn.dataset.sector || null;

      // Pretty label comes from the <span> text (e.g., "Education & Health")
      const labelSpan = btn.querySelector("span");
      selectedIndustryLabel = labelSpan
        ? labelSpan.textContent.trim()
        : selectedIndustryKey;

      updateIndustryStory();
    });
  });

  const restartButton = document.getElementById("restart-button");
  if (restartButton) {
    restartButton.addEventListener("click", () => {
      selectedIndustryKey = null;
      selectedIndustryLabel = "";
      document
        .querySelectorAll(".industry-btn")
        .forEach(b => b.classList.remove("selected"));
      updateIndustryStory();
    });
  }
}

// ---------------------------------------------
// Frame 6: "Your Industry's Story" chart
//  • X-axis = months after recovery start
//  • Uses per-industry monthly series from industry_yoy.csv
// ---------------------------------------------
function updateIndustryStory() {
  const vizContainer = d3.select("#final-viz");
  const textContainer = d3.select("#final-personal-takeaway");

  vizContainer.selectAll("*").remove();
  textContainer.text("");

  if (!selectedRecession || !selectedIndustryKey || !industrySeriesByName.size)
    return;

  const window = recoveryWindows[selectedRecession];
  if (!window) return;

  // Map from button's data-sector → CSV "industry" names
  const industryCsvNameMap = {
    // Goods-producing
    "Durable Goods": "Durable goods manufacturing",
    "Nondurable Goods": "Nondurable goods manufacturing",
    "Construction": "Construction",
    "Mining and Logging": "Mining and logging",

    // Services
    "Professional Services": "Professional and business services",
    "Private Education and Health Services": "Education and health services",
    "Leisure and Hospitality": "Leisure and hospitality",
    "Information": "Information",
    "Other Services": "Other services",

    // Trade / transport / finance / utilities / gov
    "Retail Trade": "Retail trade",
    "Wholesale Trade": "Wholesale trade",
    "Transportation and Warehousing": "Transportation and warehousing",
    "Financial Activities": "Financial activities",
    "Utilities": "Utilities",
    "Government": "Government",

    // Optional: whole economy if you add a button later
    "Total Economy": "Total nonfarm"
  };

  const csvKey =
    industryCsvNameMap[selectedIndustryKey] || selectedIndustryKey;

  const seriesAll = industrySeriesByName.get(csvKey) || [];

  if (!seriesAll.length) {
    vizContainer
      .append("p")
      .attr("class", "story-empty")
      .text("We don't have data for this industry.");
    return;
  }

  // Helper: convert (year, month) → single integer month index
  const monthIndex = (year, month) => year * 12 + (month - 1);

  const startIdx = monthIndex(window.startYear, window.startMonth);
  const endIdx = monthIndex(window.endYear, window.endMonth);

  // Filter to recovery window & sort in time
  let series = seriesAll
    .filter(d => {
      if (isNaN(d.yoy_change)) return false;
      const idx = monthIndex(d.year, d.month);
      return idx >= startIdx && idx <= endIdx;
    })
    .sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));

  if (!series.length) {
    vizContainer
      .append("p")
      .attr("class", "story-empty")
      .text(
        "We don't have YoY employment data for this industry during this recovery period."
      );
    return;
  }

  // Months since recovery start
  series.forEach(d => {
    d.monthsSinceStart = monthIndex(d.year, d.month) - startIdx;
  });

  const maxMonths = d3.max(series, d => d.monthsSinceStart);
  const maxTick = Math.ceil(maxMonths / 6) * 6; // round to next 6-month mark

  // --- NEW: dynamic y-domain based on data ---
  const rawMin = d3.min(series, d => d.yoy_change);
  const rawMax = d3.max(series, d => d.yoy_change);

  const span = Math.max(1, rawMax - rawMin);
  const pad = span * 0.1;

  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const margin = { top: 80, right: 40, bottom: 60, left: 70 };
  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = vizContainer
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, maxTick]).range([0, width]);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

  const monthTicks = d3.range(0, maxTick + 1e-6, 6);
  const yTicks = d3.ticks(yMin, yMax, 8);

  // Background band
  svg
    .append("rect")
    .attr("x", x(0))
    .attr("width", x(maxTick) - x(0))
    .attr("y", 0)
    .attr("height", height)
    .attr("fill", "#EDEDED");

  // Y gridlines
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

  // Line
  const line = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.monthsSinceStart))
    .y(d => y(d.yoy_change));

  svg
    .append("path")
    .datum(series)
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Dots
  svg
    .selectAll(".industry-dot")
    .data(series)
    .enter()
    .append("circle")
    .attr("class", "industry-dot")
    .attr("r", 4)
    .attr("cx", d => x(d.monthsSinceStart))
    .attr("cy", d => y(d.yoy_change))
    .attr("fill", "#0077CC");

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(monthTicks)
        .tickFormat(d3.format("d"))
    );

  svg.append("g").call(d3.axisLeft(y).tickValues(yTicks));

  // Zero line only if it's in range
  if (yMin < 0 && yMax > 0) {
    svg
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "black");
  }

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("font-size", "1.1rem")
    .style("font-weight", "600")
    .style("fill", "currentColor")
    .text(
      `${selectedIndustryLabel}: Year-Over-Year Employment Change During Recovery (${window.startLabel} – ${window.endLabel})`
    );

  // X axis title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "0.9rem")
    .style("fill", "currentColor")
    .text("Months After Recovery Period Started");

  // Y axis title
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .style("font-size", "0.9rem")
    .style("fill", "currentColor")
    .text("Year Over Year Employment Change (%)");

  // Narrative summary based on monthly series
  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.yoy_change - first.yoy_change;

  let direction = "stayed relatively stable";
  if (delta > 0.5) direction = "strengthened";
  if (delta < -0.5) direction = "weakened";

  const monthNames = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  const fmtMonthYear = d => `${monthNames[d.month - 1]} ${d.year}`;

  textContainer.text(
    `In ${selectedIndustryLabel}, employment ${direction} over this recovery period. ` +
      `Between ${fmtMonthYear(first)} and ${fmtMonthYear(last)}, year-over-year job growth moved ` +
      `from ${first.yoy_change.toFixed(1)}% to ${last.yoy_change.toFixed(1)}%.`
  );
}

// ---------------------------------------------
// Frame 6: recovery-period buttons
// ---------------------------------------------
function initRecoveryButtons() {
  const recButtons = document.querySelectorAll("#recovery-choice button");
  if (!recButtons.length) return;

  recButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const recId = btn.dataset.rec;

      selectedRecession = selectedRecession === recId ? null : recId;

      recButtons.forEach(b => b.classList.remove("selected"));
      if (selectedRecession) btn.classList.add("selected");

      updateIndustryStory();
    });
  });
}

// ---------------------------------------------
// Init
// ---------------------------------------------
loadViz1();





