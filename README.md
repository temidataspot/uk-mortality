# England & Wales Mortality Analysis Dashboard (2015–2024)

> **A comprehensive public & population health analytics project analysing 10 years of registered death data across England and Wales — featuring an interactive R Shiny dashboard, statistical forecasting, epidemic analysis, and a high-fidelity React showcase interface.**

**Author:** Dr Temi-Priscilla Jokotola  
**Data Source:** Office for National Statistics (ONS) — Annual Deaths Registration  
**Period Covered:** 2015–2024  
**Live Dashboard I:** [R Shiny Dashboard](https://os2u1c-prisca-joks.shinyapps.io/dashboard/)
**Live Dashboard II:** [React Dashboard](https://uk-mortality.vercel.app/)


---

## Project Overview

This project provides a full end-to-end analysis of mortality trends across England and Wales using ONS death registration data spanning 2015 to 2024. The analysis covers:

- **Overall mortality trends** — annual and monthly registered deaths, identifying structural shifts including the COVID-19 pandemic
- **Demographic breakdown** — deaths by age group, sex, marital status, and age-specific mortality rates
- **Cause of death analysis** — top causes of mortality, cause-specific trends over time, and deaths stratified by place of occurrence
- **Regional analysis** — age-standardised mortality rates (ASMR) and total deaths broken down by ONS region, county, and unitary authority across England
- **Epidemic analysis** — COVID-19 excess deaths, monthly actual versus expected mortality, and an effective reproduction number (Rt) tracker modelled on all-cause monthly deaths
- **Years of Life Lost (YLL)** — premature mortality burden under age 75 quantified per cause
- **Statistical forecasting** — ARIMA-based projections of total mortality, cause-specific trends, and excess mortality through 2027

The project culminates in a fully deployed interactive R Shiny dashboard accessible via a public URL, and a high-fidelity React showcase interface demonstrating the analytical outputs with animated visualisations and responsive filtering.

---

## Data Source & Acquisition

### Primary Source
All mortality data was obtained from the **Office for National Statistics (ONS)** — the UK's national statistical institute. The specific publication used is:

> **Deaths registered in England and Wales (Series DR)**  
> Published annually by ONS, covering registered deaths by cause, age, sex, region, and place of occurrence.

**ONS Data URL:** https://www.ons.gov.uk/peoplepopulationandcommunity/birthsdeathsandmarriages/deaths/datasets/deathsregisteredinenglandandwales

### Tables Used
The following specific tables were extracted from the ONS annual death registration workbooks:

| Table | Description | Key Variables |
|-------|-------------|---------------|
| **Table 5** | Deaths by cause and sex | ICD-10 cause groups, sex, year, total deaths |
| **Table 6** | Deaths by cause, sex, and age group | Cause, sex, age band, deaths, crude rate |
| **Table 7** | Deaths by cause and place of occurrence | Cause, place (hospital, home, care home, etc.) |
| **Table 10** | Deaths by cause — Years of Life Lost | Cause, sex, YLL under 75, YLL 16–64, mean age at death |
| **Table 11** | Monthly deaths by age and sex | Month, year, age band, sex, actual deaths, expected deaths, excess deaths |
| **Regional Table** | Deaths by region, county, unitary authority | Area name, geography type, sex, age band, deaths, ASMR |

### Data Access
The ONS publishes these statistics as annual Excel workbooks. Data for each year (2015–2024) was downloaded individually from the ONS website and collated. All files are publicly available at no cost under the **Open Government Licence v3.0**.

### Shapefile
The regional choropleth map uses the **ONS Regions (December 2022) EN BUC** boundary file (GeoJSON format), available from the ONS Open Geography Portal:

> https://geoportal.statistics.gov.uk/

The file `england_region_ons.geojson` was downloaded and stored locally at `data/external/`.

---

## Data Pipeline — mortality_analysis.R

`scripts/mortality_analysis.R` is the full data processing pipeline. It must be run before the dashboard. It performs the following steps:

### Section 1 — Libraries
Loads `tidyverse`, `readxl`, `janitor`, `lubridate`, and `scales`.

### Section 2 — Data Ingestion
Reads all raw ONS Excel workbooks from `data/raw/` using `readxl::read_excel()`. Each table is read with appropriate `skip` values to bypass ONS header rows.

### Section 3 — Data Cleaning

**Age banding:** Two custom functions are defined:
- `assign_age_band()` — maps ONS text-format age groups (e.g. `"15-19"`, `"85 and over"`) to meaningful band labels: `Neonates`, `Infants & Toddlers`, `Children`, `Young Adults`, `Middle Aged`, `Older Adults`, `Seniors`, `Elderly`
- `assign_age_band_numeric()` — maps numeric ages to the same bands (used for rate tables)

**Critical fix applied:** ONS Tables 10 and 11 store several columns (`yll_u75`, `yll_16_64`, `yll_rate`, `deaths`, `crude_rate`, `mean_age`) as character type due to footnote markers. These are coerced to numeric using `suppressWarnings(as.numeric(...))` to silently drop non-numeric footnote characters while preserving all valid values.

**Cause short names:** Full ICD-10 cause group descriptions are mapped to concise `cause_short` labels for display in charts (e.g. `"Diseases of the circulatory system"` → `"Circulatory Diseases"`).

**Sex standardisation:** "Persons" rows (ONS terminology) are relabelled to "Both Sexes" for consistency. Double-counting is avoided by filtering out `Both Sexes` rows in aggregations and using only `Male` + `Female` breakdowns.

**Regional name standardisation:** Region names are title-cased and harmonised across tables (e.g. `"YORKSHIRE AND THE HUMBER"` → `"Yorkshire and The Humber"`, `"EAST"` → `"East of England"`).

### Section 4 — Processed Data Export
Six cleaned CSVs are written to `data/processed/`:

| File | Rows (approx) | Description |
|------|---------------|-------------|
| `deaths_by_cause_place.csv` | ~45,000 | Deaths by cause, place, sex, age band, year |
| `deaths_by_region.csv` | ~28,000 | Deaths and ASMR by region/county, sex, age, year |
| `deaths_by_age_marital.csv` | ~8,000 | Deaths by age group and marital status |
| `deaths_age_specific_rates.csv` | ~12,000 | Age-specific mortality rates by age band, sex, year |
| `deaths_by_month.csv` | ~18,000 | Monthly deaths with actual, expected, and excess |
| `deaths_years_life_lost.csv` | ~6,000 | YLL under 75 and YLL 16–64 by cause and sex |

### Section 5 — Summary Statistics
Generates summary tables and verification checks printed to console.

---


### Global Sidebar Filters
The sidebar persists across all tabs and contains:

| Filter | Type | Options |
|--------|------|---------|
| Year Range | Slider | 2015–2024 |
| Region | Dropdown (searchable) | All 9 ONS regions |
| County / Unitary Authority | Dropdown (searchable) | All counties and UAs |
| Sex | Radio buttons | Both Sexes, Male, Female |
| Cause of Death | Dropdown (searchable) | All ICD-10 cause groups |

**Region scaling:** Because cause-of-death data (Table 5) does not include a regional breakdown, when a region is selected the dashboard computes a proportional scaling factor from `deaths_by_region` (selected region's deaths ÷ England total deaths) and applies it to all cause-based charts and KPI cards. This gives a meaningful regional approximation while preserving relative cause rankings.

### Tab 1 — Overview
- **4 KPI cards:** Total Deaths, Leading Cause, Peak Year, Average ASMR — all responsive to all filters
- **Annual Mortality Trend** line chart with COVID-19 annotation and optional forecast overlay
- **Top 10 Causes of Death** horizontal bar chart with abbreviated in-chart labels, legend-only y-axis
- **Top Causes Trend Over Time** multi-line chart showing all top 10 causes across 2015–2024

### Tab 2 — Demographics
- **Deaths by Age Group & Cause** stacked bar chart
- **Deaths by Sex & Cause** dodged bar chart (Male vs Female per cause)
- **Age-Specific Mortality Rates** multi-line chart by age band and year
- **Deaths by Place of Occurrence** horizontal bar chart (hospital, home, care home, hospice, other) with abbreviated labels

### Tab 3 — Epidemic Analysis
- **COVID-19 Epidemic Curve** — monthly excess deaths 2020–2024, red/blue bars above/below baseline, wave annotations
- **Monthly Mortality — Actual vs Expected** — blue bars for actual deaths, red dashed line for ONS expected baseline
- **Rt Tracker** — effective reproduction number estimated via `EpiEstim` package using parametric serial interval (mean SI = 2 months, SD = 1), fitted on monthly all-cause death counts, with 95% confidence ribbon

### Tab 4 — Regional Maps
- **Interactive choropleth map** built with `leaflet`, displaying all 9 ONS regions coloured by either ASMR or total deaths. Hover tooltips show region name, year, total deaths, and ASMR. Toggleable between ASMR and total deaths via radio buttons. Year-selectable via slider.
- **Regional Deaths Comparison** dodged bar chart comparing all regions across years. Responds to region filter and sex filter.

### Tab 5 — Causes Deep Dive
- **Cause Share Pie Chart** (donut) — proportional breakdown of all deaths by cause for selected filters
- **Deaths by Cause & Place of Occurrence** stacked horizontal bar — shows where people die for each cause (widened to `width = 8` for clarity)
- **Years of Life Lost (YLL) — Top 10 Causes** horizontal bar chart measuring premature mortality burden under age 75. Y-axis labels removed (cause names in hover/legend only) for space.

### Tab 6 — Predictions & Forecasting
> ⚠️ All forecasts display a prominent disclaimer banner at the top of the tab.

- **Overall Mortality Forecast** — ARIMA model fitted on annual totals, forecast 1–5 years ahead (slider-controlled), with 80% and 95% prediction interval bands. Actual and forecast distinguished by colour and line style with a vertical boundary marker.
- **Cause-Specific Forecast** — ARIMA fitted per cause, selectable via dropdown
- **Excess Mortality Forecast** — separate ARIMA models fitted to actual and expected deaths, subtracted to project future excess with 95% uncertainty band

---

## React Showcase Interface

`showcase/mortality_dashboard_showcase.jsx` is a standalone React component built as a high-fidelity visual companion to the R Shiny dashboard. It is designed for portfolio presentation and sharing with non-technical audiences.

### Design System
- **Colour palette:** Deep navy-obsidian (`#070b14`) base, electric cyan (`#00d4ff`) accents, crimson (`#ff3b5c`) danger signals, amber (`#ffb347`) for forecasts
- **Typography:** Bebas Neue (display/headers) + DM Sans (body) — clinical precision meets editorial drama
- **Animations:** Staggered KPI card entrance, animated number counters (eased quartic), bar chart fill animations with cubic-bezier easing, SVG line chart with gradient fill area
- **Layout:** Collapsible left sidebar + tabbed content area

### Showcase Filters (Sidebar)
The showcase includes a fully animated collapsible sidebar with four filters:

| Filter | Behaviour |
|--------|-----------|
| Year Range | Two dropdowns (From / To) updating all charts in real time |
| Sex | Toggle buttons (Both Sexes / Male / Female) |
| Region | Dropdown — applies proportional scaling to cause data |
| Cause of Death | Dropdown — narrows cause charts to selected cause |

Active filters appear as dismissible chips above the content area. A badge counter on the ☰ toggle button shows how many filters are active.

### Showcase vs Live Dashboard
| Feature | React Showcase | R Shiny Dashboard |
|---------|---------------|-------------------|
| Data source | Representative ONS-based figures | Full ONS CSVs (real data) |
| Filters | Proportional approximation | Exact row-level filtering |
| Interactivity | In-browser React state | Server-side reactive computation |
| Map | Not included | Full leaflet choropleth |
| Forecast | ARIMA estimates shown | Live `auto.arima` on actual data |
| Deployment | Embeddable JSX component | shinyapps.io public URL |

---

## Statistical Methods

### Age-Standardised Mortality Rate (ASMR)
ASMR is sourced directly from ONS and represents the number of deaths per 100,000 population, standardised to the 2013 European Standard Population. This allows fair comparison across regions and time periods with different age structures.

### Excess Deaths
Excess deaths are calculated as:

```
Excess Deaths = Actual Deaths − Expected Deaths
```

Expected deaths are provided directly by ONS in Table 11, derived from a 5-year rolling average baseline adjusted for population changes. Positive excess indicates deaths above the historical norm; negative excess indicates fewer deaths than expected.

### Effective Reproduction Number (Rt)
Rt is estimated using the `EpiEstim` R package with a parametric serial interval:
- **Mean SI:** 2 months
- **SD SI:** 1 month
- **Method:** `parametric_si`
- **Input:** Monthly all-cause death counts (Both Sexes, All Ages summary rows from Table 11)

Rt > 1 indicates growing mortality; Rt < 1 indicates declining mortality. This is applied to all-cause monthly deaths as an exploratory indicator, not as an epidemiological transmission model.

### ARIMA Forecasting
Time series forecasting uses the `forecast` package with `auto.arima()`:
- **Model selection:** Automatic order selection via AIC minimisation, stepwise search disabled (`stepwise = FALSE`) for exhaustive model search
- **Prediction intervals:** Both 80% and 95% intervals computed and displayed
- **Horizon:** User-selectable 1–5 years ahead
- **Fitting data:** 2015–2024 annual totals (10 observations)

> **Important:** With only 10 annual observations, ARIMA models should be interpreted with caution. Prediction intervals widen substantially beyond 2–3 years ahead.

### Years of Life Lost (YLL)
YLL under age 75 is sourced directly from ONS Table 10. It represents the total years of life lost due to premature deaths before age 75, calculated as the sum of (75 − age at death) across all deaths from a given cause. Higher YLL indicates a greater premature mortality burden.

---

## Key Findings

> *These findings reflect the patterns visible in the ONS data across 2015–2024.*

1. **COVID-19 dramatically elevated 2020 mortality** — registered deaths in 2020 reached approximately 689,600, approximately 30% above the pre-pandemic average, with the peak excess in April 2020 (Wave 1).

2. **Circulatory diseases and cancers remain the leading causes of death** — together they account for over 50% of all registered deaths across the decade.

3. **Persistent North–South mortality divide** — the North East consistently records the highest age-standardised mortality rate in England (ASMR ~978 per 100,000), while London records the lowest (~751 per 100,000), a gap of over 200 per 100,000.

4. **Mortality is returning to pre-pandemic levels** — after elevated excess deaths in 2020–2022, the all-cause Rt tracker shows stabilisation below 1.0 from 2022 onwards, with 2024 excess deaths significantly reduced compared to pandemic peaks.

5. **Mental & Behavioural disorders and Nervous System diseases are rising** — both show an upward trend across the decade, reflecting the ageing population and increasing prevalence of dementia-related conditions.

6. **Home deaths increased post-pandemic** — the proportion of deaths occurring at home rose noticeably from 2020 onwards, partially reflecting both COVID-related hospital pressures and longer-term shifts in end-of-life care preferences.

---

## Tools & Technologies

### R Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `shiny` | 1.7+ | Web application framework |
| `shinydashboard` | 0.7+ | Dashboard UI layout |
| `shinyWidgets` | 0.7+ | Enhanced UI widgets (pickerInput) |
| `tidyverse` | 2.0+ | Data manipulation (dplyr, tidyr, readr, ggplot2, stringr) |
| `plotly` | 4.10+ | Interactive chart rendering via ggplotly() |
| `leaflet` | 2.1+ | Interactive choropleth map |
| `sf` | 1.0+ | Spatial data handling (GeoJSON) |
| `scales` | 1.2+ | Number formatting |
| `htmltools` | 0.5+ | HTML label rendering for leaflet |
| `EpiEstim` | 2.2+ | Rt estimation (effective reproduction number) |
| `forecast` | 8.20+ | ARIMA time series forecasting (auto.arima) |
| `readxl` | 1.4+ | Reading ONS Excel workbooks |
| `janitor` | 2.2+ | Column name cleaning |
| `RColorBrewer` | 1.1+ | Chart colour palettes |

### Frontend (React Showcase)

| Technology | Purpose |
|------------|---------|
| React 18 | Component framework |
| React Hooks (useState, useEffect, useRef, useMemo) | State and side-effect management |
| SVG (hand-coded) | Custom line charts, bar charts, and sparklines |
| CSS-in-JS (inline styles) | Theming and layout |
| Google Fonts API | Bebas Neue + DM Sans typography |
| CSS keyframe animations | Entrance animations and bar fill transitions |

### Infrastructure & Deployment

| Tool | Purpose |
|------|---------|
| RStudio (Posit) | Development environment |
| shinyapps.io | Cloud hosting for R Shiny dashboard |
| `rsconnect` R package | Deployment to shinyapps.io |
| GitHub | Version control and project hosting |


---

## Deployment

The dashboard is deployed on **shinyapps.io** 

---

## Limitations & Caveats

1. **Death registration lag** — ONS data reflects registered deaths, not date of death. Some deaths occurring late in a year may be registered and counted in the following year.

2. **ICD-10 coding changes** — Cause of death classification follows ICD-10. Minor revisions to coding guidelines across years can introduce apparent trend breaks that are artefactual rather than biological.

3. **Regional cause data unavailable** — The ONS does not publish cause-of-death data broken down by both region and cause in the same table. Regional filtering of cause charts uses a proportional scaling approximation based on regional share of total deaths.

4. **ARIMA forecast limitations** — With only 10 annual data points (2015–2024), ARIMA models are fitted on a small sample. Prediction intervals widen substantially at longer horizons. Forecasts do not account for future pandemics, demographic shifts, new treatments, or policy changes.

5. **Rt tracker is exploratory** — The Rt estimation applies an epidemiological transmission model to all-cause mortality, which is not a true disease transmission process. It serves as a useful signal of mortality trend direction but should not be interpreted as an epidemiological Rt in the traditional infectious disease sense.

6. **Wales vs England granularity** — Regional data covers England only (9 ONS regions). Wales is included in national totals but not in regional/county breakdowns.

7. **React showcase uses representative data** — The React interface (`mortality_dashboard_showcase.jsx`) is built on realistic but representative figures for portfolio demonstration. It is not connected to the real ONS CSVs. The R Shiny dashboard is the authoritative analytical tool.

---

## Acknowledgements

- **Office for National Statistics (ONS)** for making annual death registration data publicly available under the Open Government Licence v3.0
- **ONS Geography team** for the regional boundary GeoJSON files
- **R Core Team** and the authors of all R packages used in this project
- **Posit (formerly RStudio)** for the development environment and shinyapps.io hosting platform
- **EpiEstim package authors** (Cori et al., 2013) for the Rt estimation methodology

---

## Licence

Data: © Crown copyright 2024, Office for National Statistics — released under [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

Code: MIT Licence — free to use, modify, and distribute with attribution.

---

*README last updated: March 2026*
