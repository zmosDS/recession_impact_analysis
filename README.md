# The Hidden Shape of Recessions: Industry Employment 1995–2024

Interactive explorable explanation of how major U.S. industries lose and regain jobs across the 2001, 2008, and 2020 recessions. The project combines a narrative slideshow with linked visualizations so viewers can compare downturns and recoveries across sectors.


**Live demo:** [Explore the Project](https://zmosds.github.io/recession_impact_analysis/)

## Goal
The goal of this project is to show how recessions affect different parts of the U.S. economy over time, from overall employment to individual industries. By stepping through an explorable story, users can see when jobs were lost, how deep each recession was, and how quickly (or slowly) different sectors recovered.

## Built With
- D3.js
- HTML, CSS, JavaScript
- Jupyter Notebooks (for data processing)
- GitHub Pages (for deployment)

## Features
- Narrative slideshow structure (AND / BUT / THEN) that guides viewers through the story
- Year‑over‑year employment chart (1995–2024) with:
  - Shaded windows for the 2001, 2008, and 2020 recessions
  - Hover snapping to the nearest year with tooltips and summary stats
  - Buttons to highlight each recession and show estimated jobs lost
- Industry grid where viewers choose the sector closest to their own
- For the selected industry:
  - “Shock & Recovery” chart comparing indexed employment paths for the 2001, 2008, and 2020 recessions
  - Trough markers showing the worst month and job loss depth
  - Bar chart showing how many jobs were gained or lost two years after each recession, plus annotations about the lowest month
- A final wrap‑up screen that ties the viewer’s choices back to the broader story

## Files
```
recession_impact_analysis/
├── index.html                      # Main explorable visualization (slideshow + charts)
├── writeup.html                    # Project write-up and prototype description
├── slideshow.js                    # Slideshow logic, frame navigation, and interactions
├── visualization.js                # YoY employment + recession shading and tooltips
├── visualization2.js               # Industry shock-and-recovery + 2-years-later bar chart
├── style.css                       # Page layout and visual styling
├── data/
│   ├── ce.series                   # Raw BLS CES series metadata (reference)
│   ├── ce.industry                 # Raw BLS CES industry codes (reference)
│   ├── ce.period                   # Raw BLS CES period codes (reference)
│   ├── ce.datatype.txt             # Raw BLS CES datatype metadata (reference)
│   ├── ce.supersector.txt          # Raw BLS CES supersector definitions (reference)
│   ├── industry_yoy.csv            # Processed yearly employment by industry
│   ├── viz1_yoy_change.csv         # Final dataset for the YoY employment chart
│   ├── viz3_and4.csv               # Final dataset for industry shock & recovery views
│   ├── data_processing.ipynb       # Data cleaning / transformation notebook
│   └── viz_data_processing.ipynb   # Notebook for visualization-specific preprocessing
└── README.md                       # Project overview and usage details
```

## Data Source
[U.S. Bureau of Labor Statistics – Current Employment Statistics (CES)](https://download.bls.gov/pub/time.series/ce/)

## Contributors
Zack M. • Jillian O. • Alex H.  
Team Smooth JAZ

## Course
DSC 209 - Data Visualization  
Fall 2025 • UC San Diego

