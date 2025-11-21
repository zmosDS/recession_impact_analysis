import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let selectedRecession = null;

/* - Load data for the YoY chart (Viz 1) - */
function loadViz1() {

    const DATA_URL = "data/viz1_yoy_change.csv";

    d3.csv(DATA_URL).then(data => {

        // Convert strings to numbers
        data.forEach(d => {
            d.year = +d.year;
            d.value = +d.value;
            d.yoy_change = +d.yoy_change;
        });

        renderViz1(data);
    });
}

/* - Build the YoY employment visualization - */
function renderViz1(data) {

    /* Chart layout + margins */
    const margin = {top: 60, right: 40, bottom: 50, left: 70};
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const container = d3.select("#yoy-chart");

    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    /* X-axis */
    const [minYear, maxYear] = d3.extent(data, d => d.year);

    const x = d3.scaleLinear()
        .domain([minYear, maxYear])
        .range([0, width]);

    // Tick layout: label every 5 years
    const startYear = Math.ceil(minYear / 5) * 5;
    const endYear = Math.floor(maxYear / 5) * 5;
    const yearTicks = d3.range(startYear, endYear + 1, 5);
    const xGridTicks = yearTicks;

    /*  Y-axis */
    const y = d3.scaleLinear()
        .domain([-7, 5])       // consistent range across all recessions
        .range([height, 0]);

    /* - Recession stats for shading & tooltips - */
    const recessions = [
        { id: "2001", label: "Dot-com Recession", start: 2001.25, end: 2003.25, startMonth: "Mar" },
        { id: "2008", label: "Great Recession",    start: 2008.0,  end: 2010.0,  startMonth: "Jan" },
        { id: "2020", label: "COVID-19 Recession", start: 2020.2,  end: 2022.2,  startMonth: "Mar" }
    ].map(r => {
        // Tooltips & year windows
        const startYear = Math.floor(r.start);
        const yearStart = startYear;
        const yearEnd = startYear + 2;

        // Estimate job loss inside the recession window
        const inRange = data.filter(d => d.year >= yearStart && d.year <= yearEnd);
        let jobsLost = null;

        if (inRange.length > 0) {
            const prePoint = data.find(d => d.year === startYear - 1);
            const minValue = d3.min(inRange, d => d.value);

            if (prePoint && minValue != null) {
                jobsLost = Math.max(0, prePoint.value - minValue);
            }
        }

        return {
            ...r,
            startYear,
            yearStart,
            yearEnd,
            startLabel: `${r.startMonth} ${startYear}`,
            jobsLost
        };
    });

    // Return recession info for a given year
    const recessionForYear = year =>
        recessions.find(r => year >= r.yearStart && year <= r.yearEnd) || null;

    /* - Draw recession windows behind the chart - */
    const recessionBands = svg.selectAll(".recession-band")
        .data(recessions)
        .enter()
        .append("rect")
        .attr("class", "recession-band")
        .attr("x", d => x(d.start))
        .attr("width", d => x(d.end) - x(d.start))
        .attr("y", 0)
        .attr("height", height);

    /* - Gridlines - */
    svg.append("g")
        .attr("class", "x-grid")
        .attr("transform", `translate(0,${height})`)
        .call(
            d3.axisBottom(x)
                .tickValues(xGridTicks)
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

    /* - Main YoY line - */
    const line = d3.line()
        .curve(d3.curveMonotoneX)   // smooth line
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

    /* Axes (bottom + left) */
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(
            d3.axisBottom(x)
                .tickValues(yearTicks)
                .tickFormat(d3.format("d"))
        );

    svg.append("g")
        .call(d3.axisLeft(y).tickValues(yGridTicks));

    /* Chart title + helper caption */
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

    /* Axis labels */
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

    /* Zero line across the chart */
    svg.append("line")
        .attr("class", "zero-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", y(0))
        .attr("y2", y(0));

    /* -----------------------------------------
       Tooltip + recession interactions
    ------------------------------------------ */
    const tooltip = d3.select("#tooltip");
    const formatJobs = d3.format(",.0f");
    const formatMillions = value => (value / 1e6).toFixed(1);

    // Update which recession band is "selected"
    const updateRecessionSelection = () => {
        recessionBands.classed("selected", d => d.id === selectedRecession);
    };

    // Hover for recession shading
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
        })
        .on("click", (event, d) => {
            selectedRecession = selectedRecession === d.id ? null : d.id;
            updateRecessionSelection();
            if (!selectedRecession) tooltip.style("opacity", 0);
        });

    updateRecessionSelection();

    /* - Draw year dots on the line - */
    const pointData = data.filter(d => !isNaN(d.yoy_change));

    svg.selectAll(".dot")
        .data(pointData)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("r", 4)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.yoy_change));

    /* - Global hover to snap to nearest year - */
    const focusDot = svg.append("circle")
        .attr("class", "focus-dot")
        .attr("r", 5)
        .style("display", "none");

    // Captures mouse movement
    const hoverCapture = svg.append("rect")
        .attr("class", "hover-capture")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", (event) => {

            const [mx] = d3.pointer(event);

            // Hide when cursor leaves chart area
            if (mx < 0 || mx > width) {
                focusDot.style("display", "none");
                if (!selectedRecession) tooltip.style("opacity", 0);
                return;
            }

            // Find nearest year to cursor
            const yearAtCursor = x.invert(mx);
            const nearest = pointData.reduce((best, d) => {
                const dist = Math.abs(d.year - yearAtCursor);
                return dist < best.dist ? { d, dist } : best;
            }, { d: pointData[0], dist: Infinity }).d;

            if (!nearest) return;

            // Move focus dot to nearest point
            focusDot
                .style("display", null)
                .attr("cx", x(nearest.year))
                .attr("cy", y(nearest.yoy_change));

            // Add recession info 
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

            tooltip
                .style("opacity", 1)
                .html(
                    `<strong>${nearest.year}</strong>` +
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
}

/* - Init: call Viz 1 (others added later) - */
loadViz1();
// loadViz2();
// loadViz3();
