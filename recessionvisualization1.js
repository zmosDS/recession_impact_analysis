import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const FILE = "bls_employment_stats.csv";

// ------------------------------------
// Recession windows
// ------------------------------------
const recessionWindows = {
  2001: { start: "2001-03", end: "2001-11" },
  2008: { start: "2007-12", end: "2009-06" },
  2020: { start: "2020-02", end: "2020-04" }
};

// ------------------------------------
// Supersector → CES series_id
// ------------------------------------
const supersectorMap = {
  "00": { name: "Total Nonfarm", series_id: "CES0000000001"},
  "05": { name: "Total Private", series_id: "CES0500000001"},
  "06": { name: "Goods-producing", series_id: "CES0600000001"},
  "07": { name: "Service-providing", series_id: "CES0700000001"},
  "08": { name: "Private service-providing", series_id: "CES0800000001"},
  "10": { name: "Mining and Logging", series_id: "CES1000000001"},
  "20": { name: "Construction", series_id: "CES2000000001"},
  "30": { name: "Manufacturing", series_id: "CES3000000001"},
  "31": { name: "Durable Goods", series_id: "CES3100000001"},
  "32": { name: "Nondurable Goods", series_id: "CES3200000001"},
  "40": { name: "Trade, Transportation, Utilities", series_id: "CES4000000001"},
  "41": { name: "Wholesale trade", series_id: "CES4142000001"},
  "42": { name: "Retail trade", series_id: "CES4200000001"},
  "43": { name: "Transportation and warehousing", series_id: "CES4300000001"},
  "44": { name: "Utilities", series_id: "CES4422000001"},
  "50": { name: "Information", series_id: "CES5000000001"},
  "55": { name: "Financial Activities", series_id: "CES5500000001"},
  "60": { name: "Professional and Business Services", series_id: "CES6000000001"},
  "65": { name: "Education and Health Services", series_id: "CES6500000001"},
  "70": { name: "Leisure and Hospitality", series_id: "CES7000000001"},
  "80": { name: "Other Services", series_id: "CES8000000001"},
  "90": { name: "Government", series_id: "CES9000000001"}
};

let rawData = [];

// ------------------------------------
// Load CSV
// ------------------------------------
d3.csv(FILE).then(data => {
  rawData = data;
  populateSupersectorDropdown();
  populateRecessionDropdown();
});

// ------------------------------------
// Populate industry dropdown
// ------------------------------------
function populateSupersectorDropdown() {
  const dropdown = document.getElementById("industrySelect");
  dropdown.innerHTML = "";
  dropdown.appendChild(new Option("- Select a Supersector -", ""));

  Object.entries(supersectorMap)
    .sort((a, b) => d3.ascending(a[1].name, b[1].name))
    .forEach(([code, obj]) =>
      dropdown.appendChild(new Option(obj.name, code))
    );

  dropdown.addEventListener("change", updateProfiles);
}

// ------------------------------------
// Populate recession dropdown
// ------------------------------------
function populateRecessionDropdown() {
  const r = document.getElementById("recessionSelect1");
  r.innerHTML = "";

  Object.keys(recessionWindows).forEach(year => {
    r.appendChild(new Option(`${year} Recession`, year));
  });

  r.addEventListener("change", updateProfiles);
}

// ------------------------------------
// MAIN UPDATE
// ------------------------------------
function updateProfiles() {
  const code = document.getElementById("industrySelect").value;
  if (!code) return;

  const seriesID = supersectorMap[code].series_id;

  const series = rawData
    .filter(d => d.series_id.trim() === seriesID)
    .map(d => ({
      date: new Date(+d.year, +d.period.slice(1) - 1),
      value: +d.value
    }))
    .sort((a, b) => a.date - b.date);

  const profiles = {};
  for (const year of Object.keys(recessionWindows)) {
    profiles[year] = extractRecessionProfile(series, recessionWindows[year]);
  }

  drawAlignedRecessionPanels(profiles);
}

// ------------------------------------
// Extract aligned recession slice
// ------------------------------------
function extractRecessionProfile(series, window) {
  const start = new Date(window.start + "-01");
  const end = new Date(window.end + "-01");

  const sliced = series.filter(d => d.date >= start && d.date <= end);
  if (!sliced.length) return [];

  const baseline = sliced[0].value;

  return sliced.map((d, i) => ({
    monthIndex: i,
    pctChange: (d.value - baseline) / baseline
  }));
}

// ------------------------------------
// DRAW ALL 3 PANELS
// ------------------------------------
function drawAlignedRecessionPanels(profiles) {
  const container = d3.select("#recessionProfiles");
  container.html("");

  const focus = document.getElementById("recessionSelect1").value;
  document.getElementById("recessionSelect1").value = focus; // keep synced

  const panelWidths = { "2001": 300, "2008": 880, "2020": 330 };
  const xLengths = { "2001": 9, "2020": 3, "2008": null };

  const height = 260;
  const margin = { top: 40, right: 20, bottom: 60, left: 80 };

  const allPts = Object.values(profiles).flat();
  const globalYExtent = d3.extent(allPts, d => d.pctChange);

  const recessionOrder = ["2001", "2008", "2020"];

  recessionOrder.forEach(key => {
    const data = profiles[key] || [];
    const isFocus = (focus === key);   // ✅ FIXED — now inside the loop

    const panelWidth = panelWidths[key];
    const innerWidth = panelWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const maxMonths = xLengths[key] ?? (data.length - 1);

    const x = d3.scaleLinear().domain([0, maxMonths]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain(globalYExtent).nice().range([innerHeight, 0]);

    const line = d3.line()
      .x(d => x(d.monthIndex))
      .y(d => y(d.pctChange));

    const svg = container.append("svg")
      .attr("width", panelWidth)
      .attr("height", height)
      .style("border", isFocus ? "3px solid #ffcc00" : "1px solid #ccc")
      .style("background", isFocus ? "#fff6d5" : "#fafafa");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(x)
          .tickValues(d3.range(0, maxMonths + 1, 2))
          .tickFormat(d => d)
      );

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")));

    // Line
    g.append("path")
      .datum(data.filter(d => d.monthIndex <= maxMonths))
      .attr("fill", "none")
      .attr("stroke", isFocus ? "#d14a00" : "#1f77b4")
      .attr("stroke-width", isFocus ? 3 : 2)
      .attr("d", line);

    // Title
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .text(`${key} Recession`);

    // X label
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 45)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Months Since Start of Recession");

    // Y label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Employment Change (%)");
  });
}

