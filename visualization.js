import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let selectedRecession = null;

/* ---------------------------------------------------------
   Load data for Viz 1
--------------------------------------------------------- */
function loadViz1() {
    const DATA_URL = "data/viz1_yoy_change.csv";

    d3.csv(DATA_URL).then(data => {
        data.forEach(d => {
            d.year = +d.year;
            d.value = +d.value;
            d.yoy_change = +d.yoy_change;
        });

        renderViz1(data);
    });
}

/* ---------------------------------------------------------
   Build YoY Employment Visualization
--------------------------------------------------------- */
function renderViz1(data) {

    const margin = { top: 60, right: 40, bottom: 50, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const container = d3.select("#yoy-chart");

    /* ------------------------------------------------------
   Button highlight + info box logic
    ------------------------------------------------------ */
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

    recButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const recId = btn.dataset.rec;

            // Update selection data
            selectedRecession = selectedRecession === recId ? null : recId;

            // Update button highlight
            recButtons.forEach(b => b.classList.remove("selected"));
            if (selectedRecession) {
                btn.classList.add("selected");
            }

            // Update info box
            const rec = recessions.find(r => r.id === selectedRecession);
            fillInfoBox(rec);

            // Update chart highlight shading
            updateRecessionSelection();
        });
});


    const svg = container
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    /* =====================================================
       Tooltip – container-relative positioning
    ===================================================== */
    const tooltip = d3.select("#tooltip");

    function tooltipPos(event) {
        const box = container.node().getBoundingClientRect();
        return {
            x: event.clientX - box.left,
            y: event.clientY - box.top
        };
    }

    const formatJobs = d3.format(",.0f");

    /* ------------------------------------------------------
       Axes, scales
    ------------------------------------------------------ */
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

    /* ------------------------------------------------------
       Recession metadata
    ------------------------------------------------------ */
    const recessions = [
        { id: "2001", label: "Dot-com Recession", start: 2001.25, end: 2003.25, startMonth: "Mar" },
        { id: "2008", label: "Great Recession", start: 2008.0, end: 2010.0, startMonth: "Jan" },
        { id: "2020", label: "COVID-19 Recession", start: 2020.2, end: 2022.2, startMonth: "Mar" }
    ].map(r => {
        const startYear = Math.floor(r.start);
        const yearStart = startYear;
        const yearEnd = startYear + 2;

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

    const recessionForYear = year =>
        recessions.find(r => year >= r.yearStart && year <= r.yearEnd) || null;

    /* ------------------------------------------------------
       Recession shading
    ------------------------------------------------------ */
    const recessionBands = svg.selectAll(".recession-band")
        .data(recessions)
        .enter()
        .append("rect")
        .attr("class", "recession-band")
        .attr("x", d => x(d.start))
        .attr("width", d => x(d.end) - x(d.start))
        .attr("y", 0)
        .attr("height", height);

    /* Gridlines */
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

    /* ------------------------------------------------------
       Main YoY Line
    ------------------------------------------------------ */
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

    /* ------------------------------------------------------
       Axes
    ------------------------------------------------------ */
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(yearTicks).tickFormat(d3.format("d")));

    svg.append("g")
        .call(d3.axisLeft(y).tickValues(yGridTicks));

    /* Titles, labels */
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

    /* =====================================================
       Tooltip Interactions — updated to use tooltipPos()
    ===================================================== */
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
                .style("left", (pos.x + 15) + "px")
                .style("top", (pos.y - 20) + "px");
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

    /* ------------------------------------------------------
       Dots + focus dot hover
    ------------------------------------------------------ */
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
}

/* Init */
loadViz1();