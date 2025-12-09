import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let selectedRecession = null;       // Frame 1 selection (for shading/info)
let industryRows = [];              // full CSV from industry_yoy.csv
let totalNonfarmRows = [];          // subset for Total Nonfarm, used in Frame 3
let selectedIndustry = null;        // chosen industry (Frame 3)
let selectedRecoveryId = null;      // 2001 / 2008 / 2020 in Frame 6

// Frame 3: single selected recession (like Frame 6)
let selectedRecessionFrame3 = null;

// Recovery windows for final-frame story (Frame 6)
const INDUSTRY_RECOVERIES = [
  {
    id: "2001",
    label: "2001 Recession",
    startYear: 2001,
    startMonth: 12,   // Dec 2001
    endYear: 2005,
    endMonth: 1       // Jan 2005
  },
  {
    id: "2008",
    label: "Great Recession",
    startYear: 2009,
    startMonth: 6,    // Jun 2009
    endYear: 2013,
    endMonth: 3       // Mar 2013
  },
  {
    id: "2020",
    label: "COVID-19 Recession",
    startYear: 2020,
    startMonth: 5,    // May 2020
    endYear: 2022,
    endMonth: 4       // Apr 2022
  }
];

// Recession windows for Frame 3 line graph
const RECESSION_WINDOWS = {
  "2001": {
    id: "2001",
    label: "2001 Recession",
    startYear: 2001,
    startMonth: 3,   // March 2001
    endYear: 2001,
    endMonth: 11     // November 2001
  },
  "2008": {
    id: "2008",
    label: "Great Recession",
    startYear: 2007,
    startMonth: 12,  // December 2007
    endYear: 2009,
    endMonth: 6      // June 2009
  },
  "2020": {
    id: "2020",
    label: "COVID-19 Recession",
    startYear: 2020,
    startMonth: 2,   // February 2020
    endYear: 2020,
    endMonth: 4      // April 2020
  }
};

// Helper: year + (month-1)/12 → decimal year
function ym(year, month) {
  return year + (month - 1) / 12;
}

// Formatting helpers
const fmtPct = d3.format(".1f");
const fmtNum = d3.format(",.0f");
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// =========================================
// Name matching helpers for industry names
// =========================================
function normalizeName(str) {
  return String(str)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getIndustryRowsForKey(key) {
  const normKey = normalizeName(key);

  // 1) exact normalized match
  let rows = industryRows.filter(d => normalizeName(d.industry) === normKey);

  // 2) fallback: contains
  if (rows.length === 0) {
    rows = industryRows.filter(d => {
      const ni = normalizeName(d.industry);
      return ni.includes(normKey) || normKey.includes(ni);
    });
  }

  return rows;
}

/* =========================================================
   VIZ 1: YoY Employment (All Industries) – Frame 1
========================================================= */

function loadViz1() {
  const DATA_URL = "data/viz1_yoy_change.csv";

  d3.csv(DATA_URL).then(data => {
    data.forEach(d => {
      d.year = +d.year;
      d.value = +d.value;
      d.yoy_change = +d.yoy_change;
    });

    // Frame 1 – fixed-width chart with sidebar
    renderViz1(data);

    // Frame 2 – full-width chart (duplicate, different container)
    renderViz2(data);
  });
}

function renderViz1(data) {
  // Get dynamic container size
  const containerNode = document.querySelector(".frame1-chart");

  // fallback if display:none (frame not active yet)
  let containerWidth = containerNode.clientWidth;
  let containerHeight = containerNode.clientHeight;

  // If frame is hidden, temporarily measure by forcing visibility
  if (containerWidth === 0) {
      const oldDisplay = containerNode.style.display;
      containerNode.style.display = "block";
      containerWidth = containerNode.clientWidth;
      containerHeight = containerNode.clientHeight;
      containerNode.style.display = oldDisplay;
  }

  // apply margins
const margin = { top: 60, right: 40, bottom: 50, left: 70 };
const width = 900 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;


  const container = d3.select("#yoy-chart");
  container.selectAll("*").remove();

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
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
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

  const x = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([0, width]);

  const startYear = Math.ceil(minYear / 5) * 5;
  const endYear = Math.floor(maxYear / 5) * 5;
  const yearTicks = d3.range(startYear, endYear + 1, 5);

  const y = d3.scaleLinear()
    .domain([-7, 5])
    .range([height, 0]);

  const recessions = [
    { id: "2001", label: "Dot-com Recession", start: 2001.25, end: 2003.25, startMonth: "Mar" },
    { id: "2008", label: "Great Recession", start: 2008.0, end: 2010.0, startMonth: "Jan" },
    { id: "2020", label: "COVID-19 Recession", start: 2020.2, end: 2022.2, startMonth: "Mar" }
  ].map(r => {
    const sYear = Math.floor(r.start);
    const yearStart = sYear;
    const yearEnd = sYear + 2;

    const inRange = data.filter(d => d.year >= yearStart && d.year <= yearEnd);

    let jobsLost = null;
    if (inRange.length > 0) {
      const prePoint = data.find(d => d.year === sYear - 1);
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

  const recessionBands = svg.selectAll(".recession-band")
    .data(recessions)
    .enter()
    .append("rect")
    .attr("class", "recession-band")
    .attr("x", d => x(d.start))
    .attr("width", d => x(d.end) - x(d.start))
    .attr("y", 0)
    .attr("height", height);

  svg.append("g")
    .attr("class", "x-grid")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(yearTicks)
        .tickSize(-height)
        .tickFormat("")
    );

  const yGridTicks = d3.range(-7, 5 + 1, 1);

  svg.append("g")
    .attr("class", "y-grid")
    .call(
      d3.axisLeft(y)
        .tickValues(yGridTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .defined(d => !isNaN(d.yoy_change))
    .x(d => x(d.year))
    .y(d => y(d.yoy_change));

  svg.append("path")
    .datum(data)
    .attr("class", "yoy-line")
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickValues(yearTicks).tickFormat(d3.format("d")));

  svg.append("g")
    .call(d3.axisLeft(y).tickValues(yGridTicks));

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
    .text("Shaded areas mark recession periods starting at the downturn month and the two years that follow.");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Year");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("YoY Change (%)");

  svg.append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  const updateRecessionSelectionShading = () => {
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
        .style("left", (pos.x + 15) + "px")
        .style("top", (pos.y - 20) + "px");
    })
    .on("mouseout", () => {
      if (!selectedRecession) tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      selectedRecession = (selectedRecession === d.id) ? null : d.id;
      updateRecessionSelectionShading();
      if (!selectedRecession) tooltip.style("opacity", 0);
    });

  updateRecessionSelectionShading();

  const pointData = data.filter(d => !isNaN(d.yoy_change));

  svg.selectAll(".dot")
    .data(pointData)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("r", 4)
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.yoy_change));

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

      if (mx < 0 || mx > width) {
        focusDot.style("display", "none");
        if (!selectedRecession) tooltip.style("opacity", 0);
        return;
      }

      const yearAtCursor = x.invert(mx);

      const nearest = pointData.reduce((best, d) => {
        const dist = Math.abs(d.year - yearAtCursor);
        return dist < best.dist ? { d, dist } : best;
      }, { d: pointData[0], dist: Infinity }).d;

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

      const yoy = nearest.yoy_change.toFixed(1);
      const totalJobs = formatJobs(nearest.value * 1000);

      const pos = tooltipPos(event);

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${nearest.year}</strong>` +
          `<br/>• YoY change: ${yoy}%` +
          `<br/>• Total jobs: ${totalJobs}` +
          recHtml
        )
        .style("left", (pos.x + 15) + "px")
        .style("top", (pos.y - 20) + "px");
    })
    .on("mouseout", () => {
      focusDot.style("display", "none");
      if (!selectedRecession) tooltip.style("opacity", 0);
    });

  // Frame 1 buttons (single-select)
  recButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const recId = btn.dataset.rec;
      selectedRecession = (selectedRecession === recId) ? null : recId;

      recButtons.forEach(b => b.classList.remove("selected"));
      if (selectedRecession) btn.classList.add("selected");

      const rec = recessions.find(r => r.id === selectedRecession);
      fillInfoBox(rec);
      updateRecessionSelectionShading();
    });
  });
}

/* =========================================================
   VIZ 2: YoY Employment (All Industries) – Frame 2 (WIDE)
========================================================= */

function renderViz2(data) {
  // ===== Historical Event Annotations (absolute coordinates + manual offsets) =====
  const eventAnnotations = [
    {
      year: 2000 + 2 / 9,  // Mar 2000
      yoy: 1.9,
      label: "Dot Com Boom",
      dx: -15,
      dy: -35
    },
    {
      year: 2001 + 8 / 12,  // Sep 2001
      yoy: -0.9,
      label: "9/11 Attacks",
      dx: -40,
      dy: 15
    },
    {
        year: 2006 + 5/12,   // June 2006
        yoy: 1.52,           // adjust after seeing its real YoY value
        label: "Housing Bubble Bursts",
        dx: -60,
        dy: -25
},
{
    year: 2008 + 8 / 12,  // Sep 2008
    yoy: -3.6,
    label: "Lehman collapses",
    dx: -135,
    dy: 12
    },
    {
        year: 2010 + 6/12,   // July 2010
        yoy: 0.24,           // adjust after seeing its real YoY value
        label: "Dodd-Frank Act Signed",
        dx: -40,
        dy: -25
},
    {
      year: 2020 + 1 / 12,  // Feb 2020
      yoy: -5.8,
      label: "Pandemic Declared",
      dx: -20,
      dy: 10
    },
    {
      year: 2020 + 2 / 12,  // Mar 2020
      yoy: -5,
      label: "US COVID Lockdowns",
      dx: 5,
      dy: 0
    },
        {
        year: 2021 + 2/12,  // March 2021
        yoy: 3.119,           // adjust after seeing its real YoY value
        label: "American Rescue Plan Signed",
        dx: -40,
        dy: -20
}
  ];

  const container = d3.select("#yoy-chart-frame2");
  if (container.empty()) return;

  // Clear any existing SVG
  container.selectAll("*").remove();

  // Measure a visible container so width is reasonable
  const hostEl =
    document.getElementById("frame-container") ||
    container.node().parentElement;

  let containerWidth = hostEl
    ? hostEl.getBoundingClientRect().width
    : 900;

  if (!containerWidth || containerWidth <= 0) {
    containerWidth = 900; // fallback
  }

  const margin = { top: 60, right: 40, bottom: 50, left: 70 };
  const width = containerWidth - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const formatJobs = d3.format(",.0f");

  const [minYear, maxYear] = d3.extent(data, d => d.year);

  const x = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([0, width]);

  const startYear = Math.ceil(minYear / 5) * 5;
  const endYear = Math.floor(maxYear / 5) * 5;
  const yearTicks = d3.range(startYear, endYear + 1, 5);

  const y = d3.scaleLinear()
    .domain([-7, 5])
    .range([height, 0]);

  const recessions = [
    { id: "2001", label: "Dot-com Recession", start: 2001.25, end: 2003.25, startMonth: "Mar" },
    { id: "2008", label: "Great Recession", start: 2008.0, end: 2010.0, startMonth: "Jan" },
    { id: "2020", label: "COVID-19 Recession", start: 2020.2, end: 2022.2, startMonth: "Mar" }
  ].map(r => {
    const sYear = Math.floor(r.start);
    const yearStart = sYear;
    const yearEnd = sYear + 2;

    const inRange = data.filter(d => d.year >= yearStart && d.year <= yearEnd);

    let jobsLost = null;
    if (inRange.length > 0) {
      const prePoint = data.find(d => d.year === sYear - 1);
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

  // Recession shading
  const recessionBands = svg.selectAll(".recession-band")
    .data(recessions)
    .enter()
    .append("rect")
    .attr("class", "recession-band")
    .attr("x", d => x(d.start))
    .attr("width", d => x(d.end) - x(d.start))
    .attr("y", 0)
    .attr("height", height);

  // Recession labels
  svg.selectAll(".recession-label")
    .data(recessions)
    .enter()
    .append("text")
    .attr("class", "recession-label")
    .attr("x", d => x(d.start) + (x(d.end) - x(d.start)) / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("font-size", "0.9rem")
    .attr("fill", "black")
    .text(d => d.label);

  // Grid lines
  svg.append("g")
    .attr("class", "x-grid")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(yearTicks)
        .tickSize(-height)
        .tickFormat("")
    );

  const yGridTicks = d3.range(-7, 5 + 1, 1);

  svg.append("g")
    .attr("class", "y-grid")
    .call(
      d3.axisLeft(y)
        .tickValues(yGridTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  // YoY line
  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .defined(d => !isNaN(d.yoy_change))
    .x(d => x(d.year))
    .y(d => y(d.yoy_change));

  svg.append("path")
    .datum(data)
    .attr("class", "yoy-line")
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickValues(yearTicks).tickFormat(d3.format("d")));

  svg.append("g")
    .call(d3.axisLeft(y).tickValues(yGridTicks));

  // Titles & labels
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
    .text("Shaded areas mark recession periods starting at the downturn month and the two years that follow.");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Year");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("YoY Change (%)");

  svg.append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  // =============================================================
  // DRAW ANNOTATION BOXES AT SPECIFIC COORDINATES (with dx/dy)
  // =============================================================
  const fontSize = 12;
  const approxCharWidth = 7;
  const paddingX = 8;
  const paddingY = 4;

  eventAnnotations.forEach(ev => {
    const px = x(ev.year);
    const py = y(ev.yoy);

    const textWidth  = ev.label.length * approxCharWidth;
    const textHeight = fontSize;

    const g = svg.append("g")
      .attr("class", "annotation")
      .attr(
        "transform",
        `translate(${px + (ev.dx || 0)}, ${py + (ev.dy || 0)})`
      );

    // Box
    g.append("rect")
      .attr("width",  textWidth + paddingX * 2)
      .attr("height", textHeight + paddingY * 2)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", "#fff")
      .attr("stroke", "#444")
      .attr("stroke-width", 1.1);

    // Label text
    g.append("text")
      .attr("x", paddingX)
      .attr("y", paddingY + textHeight - 2)
      .attr("font-size", fontSize)
      .attr("fill", "#111")
      .text(ev.label);

    // Tiny dot marking the event point
    svg.append("circle")
      .attr("cx", px)
      .attr("cy", py)
      .attr("r", 3)
      .attr("fill", "#444");
  });

  // Keep shading consistent with global selectedRecession
  const updateRecessionSelectionShading = () => {
    recessionBands.classed("selected", d => d.id === selectedRecession);
  };
  updateRecessionSelectionShading();
}



/* =========================================================
   INDUSTRY STORY DATA LOADING
========================================================= */

function loadIndustryStoryData() {
  const FILE = "data/industry_yoy.csv";

  d3.csv(FILE).then(raw => {
    industryRows = raw.map(d => ({
      ...d,
      year: +d.year,
      month: +d.month,
      value: +d.value,
      yoy_change: d.yoy_change === "" ? NaN : +d.yoy_change,
      t: ym(+d.year, +d.month),
      date: new Date(+d.year, +d.month - 1, 1)
    }));

    // Build Total Nonfarm subset for Frame 3
    totalNonfarmRows = industryRows.filter(d =>
      normalizeName(d.industry) === normalizeName("Total nonfarm") ||
      d.supersector_code === "00"
    );

    updateRecessionProfileViz(); // blank until a button is chosen
  });
}

/* =========================================================
   FRAME 3: “BUT: No two recessions behave the same.”
   SINGLE-SELECT (like Frame 6), NO LEGEND
========================================================= */

function updateRecessionProfileViz() {
  const containerEl = document.getElementById("recession-profile-viz");
  if (!containerEl) return;

  const container = d3.select(containerEl);
  container.selectAll("*").remove();

  if (!totalNonfarmRows || totalNonfarmRows.length === 0) return;

  // No selection → blank chart
  if (!selectedRecessionFrame3) return;

  const recDef = RECESSION_WINDOWS[selectedRecessionFrame3];
  if (!recDef) return;

  const startT = ym(recDef.startYear, recDef.startMonth);
  const endT = ym(recDef.endYear, recDef.endMonth);

  const rows = totalNonfarmRows
    .filter(d => d.t >= startT && d.t <= endT && !isNaN(d.yoy_change))
    .sort((a, b) => d3.ascending(a.t, b.t));

  if (rows.length === 0) return;

  const margin = { top: 70, right: 20, bottom: 45, left: 70 };
  const boxWidth = containerEl.clientWidth || 900;
  const width = boxWidth - margin.left - margin.right;
  const height = 260;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(rows, d => d.date))
    .range([0, width]);

  const [yMinRaw, yMaxRaw] = d3.extent(rows, d => d.yoy_change);
  const pad = 5;
  const y = d3.scaleLinear()
    .domain([yMinRaw - pad, yMaxRaw + pad])
    .range([height, 0]);

  const line = d3.line()
    .defined(d => !isNaN(d.yoy_change))
    .x(d => x(d.date))
    .y(d => y(d.yoy_change));

  // Zero line
  g.append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  // Main line
  g.append("path")
    .datum(rows)
    .attr("class", "industry-line")
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Dots
  g.selectAll(".recovery-dot")
    .data(rows)
    .enter()
    .append("circle")
    .attr("class", "recovery-dot")
    .attr("r", 3)
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.yoy_change));

  // ---------- X AXIS: explicit months ----------
  const monthTicks = [];
  let yCur = recDef.startYear;
  let mCur = recDef.startMonth;

  while (
    yCur < recDef.endYear ||
    (yCur === recDef.endYear && mCur <= recDef.endMonth)
  ) {
    monthTicks.push(new Date(yCur, mCur - 1, 1));
    mCur += 1;
    if (mCur > 12) {
      mCur = 1;
      yCur += 1;
    }
  }

  const xAxis = d3.axisBottom(x)
    .tickValues(monthTicks)
    .tickFormat(d3.timeFormat("%b %Y"))
    .tickSize(8);

  const yAxis = d3.axisLeft(y)
    .ticks(6)
    .ticksize(8)
    .tickFormat(d => `${d}%`);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .selectAll("text")
    .style("font-size", "10px");

  g.append("g").call(yAxis);

  g.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text("Total Year-Over-Year Employment Change");

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 32)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Month");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("YoY Employment Change (%)");
}

/* =========================================================
   FINAL FRAME (Frame 6): “Your Industry's Story”
========================================================= */
function updateFinalIndustryStory() {
  const finalBoxEl = document.getElementById("final-viz");
  const takeawayBox = document.getElementById("final-personal-takeaway");
  if (!finalBoxEl || !takeawayBox) return;

  const finalBox = d3.select(finalBoxEl);
  finalBox.selectAll("*").remove();

  if (!selectedIndustry) {
    finalBoxEl.innerHTML =
      "<p>Select an industry earlier in the story to see its recession path here.</p>";
    takeawayBox.textContent = "";
    return;
  }

  if (!selectedRecoveryId) {
    finalBoxEl.innerHTML =
      `<p>Now choose a recession recovery period above to see how <strong>${selectedIndustry}</strong> moved through it.</p>`;
    takeawayBox.textContent = "";
    return;
  }

  if (!industryRows || industryRows.length === 0) {
    finalBoxEl.innerHTML = "<p>Loading employment data… try again in a moment.</p>";
    takeawayBox.textContent = "";
    return;
  }

  const recDef = INDUSTRY_RECOVERIES.find(r => r.id === selectedRecoveryId);
  if (!recDef) {
    finalBoxEl.innerHTML = "<p>Sorry, that recovery window isn’t defined.</p>";
    takeawayBox.textContent = "";
    return;
  }

  const rows = getIndustryRowsForKey(selectedIndustry);
  if (rows.length === 0) {
    finalBoxEl.innerHTML =
      `<p>No data available for <strong>${selectedIndustry}</strong> in this dataset.</p>`;
    takeawayBox.textContent = "";
    return;
  }

  rows.sort((a, b) => d3.ascending(a.t, b.t));

  const startT = ym(recDef.startYear, recDef.startMonth);
  const endT = ym(recDef.endYear, recDef.endMonth);

  const windowRows = rows
    .filter(r => r.t >= startT && r.t <= endT && !isNaN(r.yoy_change))
    .map(r => {
      const monthsSinceStart =
        (r.year - recDef.startYear) * 12 + (r.month - recDef.startMonth);
      return { ...r, monthsSinceStart };
    });

  if (windowRows.length === 0) {
    finalBoxEl.innerHTML =
      `<p>No year-over-year data to plot for <strong>${selectedIndustry}</strong> in this recovery window.</p>`;
    takeawayBox.textContent = "";
    return;
  }

  const baseline = windowRows[0];
  const endPoint = windowRows[windowRows.length - 1];

  const startRate = baseline.yoy_change;
  const endRate = endPoint.yoy_change;
  const change = endRate - startRate;

  const yoyFmt = v => `${fmtPct(v)}%`;

  const margin = { top: 85, right: 10, bottom: 60, left: 70 };
  const boxWidth = finalBoxEl.clientWidth || 900;
  const width = boxWidth - margin.left - margin.right;
  const height = 390;

  const svg = finalBox
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const maxMonth = d3.max(windowRows, d => d.monthsSinceStart);
  const x = d3.scaleLinear()
    .domain([0, maxMonth])
    .range([0, width]);

  const [yMinRaw, yMaxRaw] = d3.extent(windowRows, d => d.yoy_change);
  const pad = 5;
  const y = d3.scaleLinear()
    .domain([yMinRaw - pad, yMaxRaw + pad])
    .range([height, 0]);

  const line = d3.line()
    .defined(d => !isNaN(d.yoy_change))
    .x(d => x(d.monthsSinceStart))
    .y(d => y(d.yoy_change));

  // --------------------------------------------------
  // GRID (matching Frame 2 styling via .x-grid/.y-grid)
  // --------------------------------------------------
  const step = 6;
  const xTicks = d3.range(0, maxMonth + 1, step);
  const yTicks = y.ticks(6);

  g.append("g")
    .attr("class", "x-grid")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(xTicks)
        .tickSize(-height)
        .tickFormat("")
    );

  g.append("g")
    .attr("class", "y-grid")
    .call(
      d3.axisLeft(y)
        .tickValues(yTicks)
        .tickSize(-width)
        .tickFormat("")
    );

  // Zero line (same class as other frames)
  g.append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  // Main line
  g.append("path")
    .datum(windowRows)
    .attr("class", "industry-line")
    .attr("fill", "none")
    .attr("stroke", "#0077CC")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Dots
  g.selectAll(".recovery-dot")
    .data(windowRows)
    .enter()
    .append("circle")
    .attr("class", "recovery-dot")
    .attr("r", 3)
    .attr("cx", d => x(d.monthsSinceStart))
    .attr("cy", d => y(d.yoy_change));

  // Axes
 const xAxis = d3.axisBottom(x)
  .tickValues(xTicks);

const yAxis = d3.axisLeft(y)
  .ticks(6)
  .tickFormat(d => `${d}%`);

// X axis
const xAxisG = g.append("g")
  .attr("transform", `translate(0,${height})`)
  .call(xAxis);

// Y axis
const yAxisG = g.append("g")
  .call(yAxis);

// 🔹 Make tick labels larger + match font
xAxisG.selectAll("text")
  .style("font-size", "0.9rem")   // bump this up if you want bigger
  .style("font-family", "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");

yAxisG.selectAll("text")
  .style("font-size", "0.9rem")
  .style("font-family", "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");

  const startLabel = `${monthNames[recDef.startMonth - 1]} ${recDef.startYear}`;
  const endLabel = `${monthNames[recDef.endMonth - 1]} ${recDef.endYear}`;

  // Title
  g.append("text")
    .attr("x", width / 2)
    .attr("y", -25)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text(
      `${selectedIndustry}: Year-Over-Year Employment Change During Recovery (${startLabel} – ${endLabel})`
    );

  // X axis label (already had class)
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Months After Recovery Period Started");

  // Y axis label — NOW with .axis-label class to match Frame 2
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("YoY Employment Change (%)");

  let verb = "changed";
  if (change > 0.5) verb = "strengthened";
  else if (change < -0.5) verb = "softened";

  takeawayBox.textContent =
    `In ${selectedIndustry}, employment ${verb} over this recovery period. ` +
    `Between ${startLabel} and ${endLabel}, year-over-year job growth moved from ${yoyFmt(startRate)} to ${yoyFmt(endRate)}.`;
}
/* =========================================================
   FRAME 7: Bar chart — Jobs gained by industry
========================================================= */
function renderRecoveryBarViz(recIdOverride = null) {
  const containerEl = document.getElementById("recovery-bar-viz");
  if (!containerEl) return;

  const takeawayEl = document.getElementById("recovery-bar-takeaway");
  if (takeawayEl) takeawayEl.textContent = "";  // clear old text

  const container = d3.select(containerEl);
  container.selectAll("*").remove();

  if (!industryRows || industryRows.length === 0) {
    containerEl.innerHTML = "<p>Loading industry data…</p>";
    return;
  }

  // Use the same recovery windows as Frame 6
  const activeRecId = recIdOverride || "2008";
  const recDef = INDUSTRY_RECOVERIES.find(r => r.id === activeRecId);
  if (!recDef) {
    containerEl.innerHTML = "<p>No recovery window defined for that recession.</p>";
    return;
  }

  const startT = ym(recDef.startYear, recDef.startMonth);
  const endT   = ym(recDef.endYear,   recDef.endMonth);

  // Industries should match the options from the selection grid (Frame 3)
  const industryButtons = Array.from(document.querySelectorAll(".industry-btn"));
  const allowedKeys = industryButtons.map(btn =>
    (btn.dataset.sector && btn.dataset.sector.trim().length > 0)
      ? btn.dataset.sector.trim()
      : btn.textContent.trim()
  );

  // Map: normalized CSV name → button label
  const labelByNormName = new Map(
    allowedKeys.map(label => [normalizeName(label), label])
  );

  const selectedNorm = selectedIndustry ? normalizeName(selectedIndustry) : null;

  // Group rows in the recovery window by industry name from the CSV
  const byIndustry = d3.group(
    industryRows.filter(d => d.t >= startT && d.t <= endT),
    d => d.industry
  );

  const bars = [];

  for (const [csvIndustryName, rows] of byIndustry.entries()) {
    const normCsv = normalizeName(csvIndustryName);
    const label = labelByNormName.get(normCsv);
    if (!label) continue; // skip industries that don't have a button

    const sorted = rows
      .filter(d => !isNaN(d.value))
      .sort((a, b) => d3.ascending(a.t, b.t));

    if (sorted.length < 2) continue;

    // value is thousands of jobs → convert to raw jobs
    const startValJobs = sorted[0].value * 1000;
    const endValJobs   = sorted[sorted.length - 1].value * 1000;
    const jobsGained   = endValJobs - startValJobs;

    bars.push({
      industryLabel: label,
      jobsGained,
      isSelected: selectedNorm && normalizeName(label) === selectedNorm
    });
  }

  if (!bars.length) {
    containerEl.innerHTML =
      "<p>Not enough industry data to compute jobs gained for this recovery.</p>";
    return;
  }

  // Order barplot by jobs gained, descending
  bars.sort((a, b) => d3.descending(a.jobsGained, b.jobsGained));
  const industries = bars.map(d => d.industryLabel);

  // Y domain & ticks at 500,000 jobs
  const rawMaxGain = d3.max(bars, d => d.jobsGained);
  const rawMinGain = d3.min(bars, d => d.jobsGained);
  const tickStep = 500000; // 50k jobs

  let yMax = Math.ceil(rawMaxGain / tickStep) * tickStep;
  let yMin = Math.floor(rawMinGain / tickStep) * tickStep;

  // Always include 0 on the axis
  if (yMax < 0) yMax = 0;
  if (yMin > 0) yMin = 0;

  const margin = { top: 60, right: 20, bottom: 160, left: 130 };
  const boxWidth = containerEl.clientWidth || 900;
  const width = boxWidth - margin.left - margin.right;
  const height = 360;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X: industries in sorted order
  const x = d3.scaleBand()
    .domain(industries)
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height, 0]);

  const yTicks = d3.range(yMin, yMax + tickStep, tickStep);

  // Y axis
  const yAxis = d3.axisLeft(y)
    .tickValues(yTicks)
    .tickFormat(d => d3.format(",")(d));

  const yAxisG = g.append("g").call(yAxis);
  yAxisG.selectAll("text")
    .style("font-size", "0.85rem");

  // X axis
  const xAxis = d3.axisBottom(x);
  const xAxisG = g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);

xAxisG.selectAll("text")
  .style("font-size", "0.8rem")
  .attr("text-anchor", "end")
  .attr("dx", "-0.5em")          // further to the right
  .attr("dy", "1.25em")          // tiny vertical tweak
  .attr("transform", "translate(20,0) rotate(-28)");

  // Zero line
  g.append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0));

  // Bars (highlight selected industry)
  g.selectAll(".recovery-bar")
    .data(bars)
    .enter()
    .append("rect")
    .attr("class", "recovery-bar")
    .attr("x", d => x(d.industryLabel))
    .attr("width", x.bandwidth())
    .attr("y", d => d.jobsGained >= 0 ? y(d.jobsGained) : y(0))
    .attr("height", d => Math.abs(y(d.jobsGained) - y(0)))
    .attr("fill", d => {
      if (d.isSelected) {
        // highlighted version of the normal colors
        return d.jobsGained >= 0 ? "#1E88E5" : "#E53935";
      }
      return d.jobsGained >= 0 ? "#4CAF50" : "#D32F2F";
    })
    .attr("stroke", d => d.isSelected ? "#000" : "none")
    .attr("stroke-width", d => d.isSelected ? 1.5 : 0);

  // Bar labels
  g.selectAll(".bar-label")
    .data(bars)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.industryLabel) + x.bandwidth() / 2)
    .attr("y", d => d.jobsGained >= 0 ? y(d.jobsGained) - 6 : y(d.jobsGained) + 14)
    .attr("text-anchor", "middle")
    .style("font-size", "0.7rem")
    .text(d => d3.format("+,.0f")(d.jobsGained));

  const startLabel = `${monthNames[recDef.startMonth - 1]} ${recDef.startYear}`;
  const endLabel   = `${monthNames[recDef.endMonth - 1]} ${recDef.endYear}`;

  // Chart title
  g.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text(`Jobs Gained by Industry During ${recDef.label} Recovery`);

  // Subtitle with dates (on its own line)
  g.append("text")
    .attr("x", width / 2)
    .attr("y", 12)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text(`(${startLabel} – ${endLabel})`);

  // X-axis title
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 95)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Industry");

  // Y-axis title
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -85)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Number of jobs gained");

  // ----------------------------
  // Personalized annotation text
  // ----------------------------
  if (takeawayEl && selectedIndustry) {
    const selectedBar = bars.find(b => b.isSelected);
    if (selectedBar) {
      const jobs = selectedBar.jobsGained;
      const absJobs = Math.abs(jobs);

      let magnitude;
      if (absJobs >= 1_000_000) {
        magnitude = `${(absJobs / 1_000_000).toFixed(1)}M`;
      } else if (absJobs >= 1000) {
        magnitude = `${(absJobs / 1000).toFixed(1)}k`;
      } else {
        magnitude = d3.format(",.0f")(absJobs);
      }

      if (jobs > 0) {
        takeawayEl.textContent =
          `${selectedIndustry} gained about ${magnitude} jobs over the ${recDef.label} recovery — a strong rebound from the downturn.`;
      } else if (jobs < 0) {
        takeawayEl.textContent =
          `${selectedIndustry} is still down about ${magnitude} jobs compared with the start of the ${recDef.label} recovery — a sign of a lasting structural change.`;
      } else {
        takeawayEl.textContent =
          `${selectedIndustry} ended the ${recDef.label} recovery with roughly the same number of jobs it started with.`;
      }
    } else {
      // industry selected but not in this recovery window
      takeawayEl.textContent =
        `Your selected industry (${selectedIndustry}) doesn’t appear in this recovery window, so we can’t compute its job gains here.`;
    }
  }
}

/* =========================================================
   WIRING: Industry selection + Recovery choice + Frame 3
========================================================= */

// ---------- Frame 3 – industry choice ----------
document.querySelectorAll(".industry-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // Visual state
    document.querySelectorAll(".industry-btn").forEach(b =>
      b.classList.remove("selected")
    );
    btn.classList.add("selected");

    // Which industry?
    const keyFromData = btn.dataset.sector;
    selectedIndustry = keyFromData && keyFromData.trim().length > 0
      ? keyFromData.trim()
      : btn.textContent.trim();

    // Reset final-frame recession selection
    selectedRecoveryId = null;
    document.querySelectorAll("#recovery-choice button").forEach(b =>
      b.classList.remove("selected")
    );

    // Update final-frame text
    const finalBoxEl = document.getElementById("final-viz");
    const takeawayBox = document.getElementById("final-personal-takeaway");
    if (finalBoxEl) {
      finalBoxEl.innerHTML =
        `<p>You chose <strong>${selectedIndustry}</strong>. Once you reach the final slide, pick a recession recovery period to see how this industry moved through it.</p>`;
    }
    if (takeawayBox) takeawayBox.textContent = "";
  });
});

// ---------- Frame 6 – recovery buttons (single-select with toggle) ----------
const recoveryButtons = Array.from(
  document.querySelectorAll("#recovery-choice button")
);

recoveryButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const recId = btn.dataset.rec;

    if (selectedRecoveryId === recId) {
      // Click same button again → clear selection
      selectedRecoveryId = null;
    } else {
      selectedRecoveryId = recId;
    }

    // Update button styles so only the active one has .selected
    recoveryButtons.forEach(b => {
      b.classList.toggle("selected", selectedRecoveryId === b.dataset.rec);
    });

    updateFinalIndustryStory();
  });
});

// ---------- Frame 7 – recovery bar buttons ----------
const recoveryBarButtons = Array.from(
  document.querySelectorAll("#recovery-bar-choice button")
);

recoveryBarButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const recId = btn.dataset.rec;

    recoveryBarButtons.forEach(b =>
      b.classList.toggle("selected", b === btn)
    );

    renderRecoveryBarViz(recId);
  });
});

// ---------- Frame 3 – recession-period buttons (single-select with toggle) ----------
const periodButtons = Array.from(
  document.querySelectorAll("#recession-period-choice button")
);

periodButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const recId = btn.dataset.rec;

    if (selectedRecessionFrame3 === recId) {
      // Click same button again → clear selection & blank chart
      selectedRecessionFrame3 = null;
    } else {
      // Select this recession
      selectedRecessionFrame3 = recId;
    }

    // Only the currently active recession (if any) should be highlighted
    periodButtons.forEach(b => {
      b.classList.toggle("selected", selectedRecessionFrame3 === b.dataset.rec);
    });

    // Draw or clear the Frame 3 chart
    updateRecessionProfileViz();
  });
});

// ---------- Restart button (used together with slideshow.js) ----------
const restartBtn = document.getElementById("restart-button");
if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    // Clear global state
    selectedIndustry = null;
    selectedRecoveryId = null;
    selectedRecessionFrame3 = null;

    // Clear button styles
    document.querySelectorAll(".industry-btn").forEach(b =>
      b.classList.remove("selected")
    );
    recoveryButtons.forEach(b => b.classList.remove("selected"));
    periodButtons.forEach(b => b.classList.remove("selected"));

    // Clear final frame content
    const finalBoxEl = document.getElementById("final-viz");
    const takeawayBox = document.getElementById("final-personal-takeaway");
    if (finalBoxEl) finalBoxEl.innerHTML = "";
    if (takeawayBox) takeawayBox.textContent = "";

    // Clear Frame 3 chart
    updateRecessionProfileViz();
  });
}

/* =========================================================
   INIT
========================================================= */
loadViz1();
loadIndustryStoryData();

