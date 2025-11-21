import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const FILE = "bls_employment_stats.csv";
const TARGET_SERIES = "CES0000000001";

// recession periods
const recessions = [
  { name: "2001 Recession", start: "2001-03", end: "2001-11" },
  { name: "2008 Recession", start: "2007-12", end: "2009-06" },
  { name: "2020 Recession", start: "2020-02", end: "2020-04" }
];

// ===============================
// LOAD + PROCESS DATA
// ===============================
d3.csv(FILE).then(raw => {
  const data = raw
    .filter(d => d.series_id.trim() === TARGET_SERIES)
    .map(d => ({
      year: +d.year,
      month: +d.period.slice(1),
      value: +d.value,
      date: new Date(+d.year, +d.period.slice(1) - 1)
    }))
    .sort((a, b) => a.date - b.date);

  // filter range 1995–2024
  const filtered = data.filter(d =>
    d.date.getFullYear() >= 1995 &&
    d.date.getFullYear() <= 2024
  );

  drawChart(filtered);
  enableRecessionInteraction();
});


// ===============================
// DRAW THE EMPLOYMENT LEVEL CHART
// ===============================
function drawChart(data) {

  const svg = d3.select("#yoyChart")
    .attr("width", 1000)
    .attr("height", 580);

  svg.selectAll("*").remove(); // clear before drawing

  const width = +svg.attr("width");
  const height = +svg.attr("height");

  const margin = { top: 60, right: 40, bottom: 70, left: 90 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // --- SCALES ---
  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.value)).nice()
    .range([innerHeight, 0]);

  // --- AXES ---
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  g.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format(",d")));

  // ===============================
  // AXIS TITLES
  // ===============================

  // X-axis title
  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height - 20) 
    .style("font-size", "16px")
    .text("Year");

  // Y-axis title
  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", `translate(20, ${height / 2}) rotate(-90)`)
    .style("font-size", "16px")
    .text("Total Employment (Thousands)");

  // ===============================
  // RECESSION SHADING + LABELS
  // ===============================
  const recessionGroup = g.append("g").attr("class", "recessions");

  recessions.forEach(r => {
    const start = new Date(r.start + "-01");
    const end = new Date(r.end + "-01");

    recessionGroup.append("rect")
      .attr("class", "recession-rect")
      .attr("x", x(start))
      .attr("width", x(end) - x(start))
      .attr("y", 0)
      .attr("height", innerHeight)
      .attr("fill", "#d8d8d8")
      .attr("opacity", 0.4);

    recessionGroup.append("text")
      .attr("x", x(start) + 5)
      .attr("y", 20)
      .text(r.name)
      .attr("fill", "#444")
      .style("font-size", "12px");
  });

  // ===============================
  // EMPLOYMENT LINE
  // ===============================
  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value));

  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2)
    .attr("d", line);

  // ===============================
  // LEGEND
  // ===============================
  const legend = svg.append("g")
    .attr("transform", "translate(50, 20)");

  legend.append("rect")
    .attr("width", 20)
    .attr("height", 12)
    .attr("fill", "#d8d8d8")
    .attr("opacity", 0.4);

  legend.append("text")
    .attr("x", 30)
    .attr("y", 10)
    .text("Economic Recession")
    .style("font-size", "14px");

  // ===============================
  // TITLE
  // ===============================
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "22px")
    .style("font-weight", "700")
    .text("Total Employment Levels (1995–2024)");
}


// ===============================
// INTERACTION: HIGHLIGHT A RECESSION
// ===============================
function enableRecessionInteraction() {
  const select = document.getElementById("recessionSelect");

  if (!select) return;

  select.addEventListener("change", e => {
    const selected = e.target.value;
    const rects = document.querySelectorAll(".recession-rect");

    rects.forEach(r => {
      r.style.opacity = 0.35;
      r.style.fill = "#d8d8d8";
    });

    if (!selected) return;

    const index = recessions.findIndex(r =>
      r.name.includes(selected)
    );

    if (index >= 0) {
      const rect = rects[index];
      rect.style.opacity = 0.85;
      rect.style.fill = "#ffcc00";
    }
  });
}



