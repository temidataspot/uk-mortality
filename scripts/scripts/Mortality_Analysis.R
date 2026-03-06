# PROJECT:     Public & Population Health — England & Wales Mortality Analysis
# Data Source: ONS Annual Deaths Registration Data (2015–2024)
# Author:      Dr Temiloluwa Priscilla Jokotola
# Date:        2026

# AIMS:
#   1. Describe the burden and distribution of mortality in England & Wales
#      across cause, age, sex, place, and region (2015–2024)
#   2. Identify the top 10 leading causes of death and their trends over time
#   3. Quantify the impact of COVID-19 on excess mortality
#   4. Estimate the effective reproduction number (Rt) for all-cause and
#      infectious-cause mortality using EpiEstim
#   5. Map regional variation in age-standardised mortality rates (ASMR)
#   6. Quantify premature mortality burden using Years of Life Lost (YLL)

# OUTPUTS:
#   - Cleaned datasets saved to:    data/processed/
#   - EDA visualisations:           ggplot2 plots displayed in RStudio Viewer
#   - Epidemic curves & Rt tracker: Sections 7 and 8
#   - Regional choropleth maps:     Section 9 (leaflet)
#   - Interactive dashboard:        dashboard.R

# DATA TABLES USED:
#   Table 2  → Deaths by region (with ASMR)
#   Table 3  → Deaths by age and marital status
#   Table 5  → Deaths by cause, place, age group, sex
#   Table 7  → Years of Life Lost (YLL)
#   Table 10 → Age-specific mortality rates
#   Table 11 → Deaths by month (observed, expected, excess)

# installing needed pkgs
install.packages(c("tidyverse", "readxl", "ggplot2", "scales", "writexl", "EpiEstim", "sf", "leaflet", "htmltools"))

# SECTION 1: Load Libraries
library(tidyverse)   # Data wrangling (dplyr, tidyr) and ggplot2 visualisation
library(readxl)      # Reading Excel files
library(ggplot2)     # Static visualisation
library(scales)      # Axis formatting (comma, percent labels)
library(writexl)     # Writing Excel outputs if needed
library(EpiEstim)    # Rt (effective reproduction number) calculation
library(sf)          # Spatial data: reading and joining shapefiles
library(leaflet)     # Interactive choropleth maps
library(htmltools)   # HTML label rendering for leaflet popups

# SECTION 2: Load Data from ONS Excel File
# All tables loaded from: data/raw/annualdeaths2024.xlsx
# Each sheet skips the first 4 rows of ONS metadata/headers
deaths_by_cause_place     <- read_excel("data/raw/annualdeaths2024.xlsx", sheet = "Table_5",  skip = 4)
deaths_by_region          <- read_excel("data/raw/annualdeaths2024.xlsx", sheet = "Table_2",  skip = 4)
deaths_by_age_marital     <- read_excel("data/raw/annualdeaths2024.xlsx", sheet = "Table_3",  skip = 4)
deaths_age_specific_rates <- read_excel("data/raw/annualdeaths2024.xlsx", sheet = "Table_10", skip = 4)
deaths_by_month           <- read_excel("data/raw/annualdeaths2024.xlsx", sheet = "Table_11", skip = 4)
deaths_years_life_lost    <- read_excel("data/raw/annualdeaths2024.xlsx", sheet = "Table_7",  skip = 4)

View(deaths_by_cause_place)
View(deaths_by_region)
View(deaths_by_age_marital)
View(deaths_by_month)
View(deaths_years_life_lost)
View(deaths_age_specific_rates)


# SECTION 3: Define Age Banding Functions
# Assigns consistent age bands used across all datasets.
# Bands: Neonates | Infants & Toddlers | Children | Young Adults |
#        Middle Aged | Older Adults | Seniors | Elderly | All Ages
# Two versions: text-based labels (Tables 5/7/10/11) and numeric (Table 3)

# --- 3a: Text-based age labels (used in Tables 5, 7, 10, 11) ---
assign_age_band <- function(age) {
  case_when(
    age %in% c("Neonatal deaths (under 28 days)")                            ~ "Neonates",
    age %in% c("Postneonatal deaths (28 days) - 4 years", "0 to 29")        ~ "Infants & Toddlers",
    age %in% c("5 to 14")                                                    ~ "Children",
    age %in% c("15 to 44", "30 to 44")                                      ~ "Young Adults",
    age %in% c("45 to 64", "45 to 49", "50 to 54", "55 to 59", "60 to 64") ~ "Middle Aged",
    age %in% c("65 to 74", "65 to 69", "70 to 74")                          ~ "Older Adults",
    age %in% c("75 to 84", "75 to 79", "80 to 84")                          ~ "Seniors",
    age %in% c("85 years and over", "85 to 89", "90 and over")              ~ "Elderly",
    age %in% c("All ages", "All ages (excluding neonatal deaths)",
               "All ages (excluding under 1)")                               ~ "All Ages",
    TRUE                                                                     ~ NA_character_
  )
}

# 3b: Numeric ages (Table 3 — individual years 0 to 105+)
assign_age_band_numeric <- function(age) {
  age_num <- suppressWarnings(as.numeric(age))
  case_when(
    age == "All ages"               ~ "All Ages",
    age_num == 0                    ~ "Neonates",
    age_num >= 1  & age_num <= 4   ~ "Infants & Toddlers",
    age_num >= 5  & age_num <= 14  ~ "Children",
    age_num >= 15 & age_num <= 44  ~ "Young Adults",
    age_num >= 45 & age_num <= 64  ~ "Middle Aged",
    age_num >= 65 & age_num <= 74  ~ "Older Adults",
    age_num >= 75 & age_num <= 84  ~ "Seniors",
    age_num >= 85                  ~ "Elderly",
    TRUE                           ~ NA_character_
  )
}

# SECTION 4: Clean & Standardise All Datasets
# For each dataset:
#   - Rename columns to clean snake_case names
#   - Standardise sex label "All people" → "Both Sexes"
#   - Add age_band column using the functions above
#   - Filter to study period: 2015–2024

# Table 5: Deaths by Cause, Place, Age Group, Sex 

deaths_by_cause_place <- deaths_by_cause_place |>
  rename(
    year       = `Year of registration`,
    sex        = Sex,
    age_group  = `Age group`,
    icd10_code = `ICD-10 chapter codes`,
    cause      = `ICD-10 chapter name`,
    place      = `Place of death`,
    deaths     = `Number of deaths`
  ) |>
  mutate(
    year     = as.integer(year),
    sex      = if_else(sex == "All people", "Both Sexes", sex),
    age_band = assign_age_band(age_group),
    # Shorten verbose ICD-10 chapter names to readable short labels
    cause_short = case_when(
      str_detect(cause, "infectious and parasitic") ~ "Infectious & Parasitic Diseases",
      str_detect(cause, "Neoplasms")                ~ "Cancers & Neoplasms",
      str_detect(cause, "blood")                    ~ "Blood & Immune Disorders",
      str_detect(cause, "Endocrine")                ~ "Endocrine & Metabolic Diseases",
      str_detect(cause, "Mental")                   ~ "Mental & Behavioural Disorders",
      str_detect(cause, "nervous system")           ~ "Nervous System Diseases",
      str_detect(cause, "eye")                      ~ "Eye Diseases",
      str_detect(cause, "ear")                      ~ "Ear Diseases",
      str_detect(cause, "circulatory")              ~ "Circulatory Diseases",
      str_detect(cause, "respiratory")              ~ "Respiratory Diseases",
      str_detect(cause, "digestive")                ~ "Digestive Diseases",
      str_detect(cause, "skin")                     ~ "Skin Diseases",
      str_detect(cause, "musculoskeletal")          ~ "Musculoskeletal Diseases",
      str_detect(cause, "genitourinary")            ~ "Genitourinary Diseases",
      str_detect(cause, "Pregnancy")                ~ "Pregnancy & Childbirth",
      str_detect(cause, "perinatal")                ~ "Perinatal Conditions",
      str_detect(cause, "Congenital")               ~ "Congenital Abnormalities",
      str_detect(cause, "Symptoms")                 ~ "Symptoms & Abnormal Findings",
      str_detect(cause, "External")                 ~ "External Causes",
      str_detect(cause, "special purposes")         ~ "Special Purposes & COVID",
      cause == "All causes"                         ~ "All Causes",
      TRUE                                          ~ cause
    )
  ) |>
  filter(year >= 2015 & year <= 2024)


# Table 2: Deaths by Region (includes ASMR per 100,000) 
deaths_by_region <- deaths_by_region |>
  rename(
    year      = `Year of registration`,
    sex       = Sex,
    area_code = `Area code`,
    area_name = `Area name`,
    geography = `Geography level`,
    deaths    = `Number of deaths`,
    asmr      = `Age standardised mortality rate (ASMR)`
  ) |>
  mutate(
    year = as.integer(year),
    sex  = if_else(sex == "All people", "Both Sexes", sex)
  ) |>
  filter(year >= 2015 & year <= 2024)


# Table 3: Deaths by Age and Marital Status
deaths_by_age_marital <- deaths_by_age_marital |>
  rename(
    year           = `Year of registration`,
    sex            = Sex,
    age            = `Age (years)`,
    marital_status = `Marital status`,
    deaths         = `Number of deaths`
  ) |>
  mutate(
    year     = as.integer(year),
    sex      = if_else(sex == "All people", "Both Sexes", sex),
    age_band = assign_age_band(age)
  ) |>
  filter(year >= 2015 & year <= 2024)


# Table 10: Age-Specific Mortality Rates (with confidence intervals)
deaths_age_specific_rates <- deaths_age_specific_rates |>
  rename(
    year      = `Year of registration`,
    sex       = Sex,
    age_group = `Age group (years)`,
    rate      = `Age-specific rate`,
    lower_ci  = `Lower confidence limit`,
    upper_ci  = `Upper confidence limit`
  ) |>
  mutate(
    year     = as.integer(year),
    sex      = if_else(sex == "All people", "Both Sexes", sex),
    age_band = assign_age_band(age_group),
    # Override age_band for Table 10-specific labels not covered by shared function
    age_band = case_when(
      age_group == "Under 1"                                              ~ "Neonates",
      age_group == "1 to 4"                                              ~ "Infants & Toddlers",
      age_group %in% c("5 to 9", "10 to 14")                            ~ "Children",
      age_group %in% c("15 to 19", "20 to 24", "25 to 29",
                       "30 to 34", "35 to 39", "40 to 44")              ~ "Young Adults",
      age_group %in% c("45 to 49", "50 to 54", "55 to 59", "60 to 64") ~ "Middle Aged",
      age_group %in% c("65 to 69", "70 to 74")                         ~ "Older Adults",
      age_group %in% c("75 to 79", "80 to 84")                         ~ "Seniors",
      age_group %in% c("85 to 89", "90 and over")                      ~ "Elderly",
      age_group == "All ages"                                            ~ "All Ages",
      TRUE                                                               ~ age_band
    )
  ) |>
  filter(year >= 2015 & year <= 2024)


# Table 11: Deaths by Month (includes expected & excess deaths) ---
deaths_by_month <- deaths_by_month |>
  rename(
    year       = `Year of registration`,
    month      = `Month of registration`,
    sex        = Sex,
    age_group  = `Age group (years)`,
    deaths     = `Number of deaths`,
    expected   = `Expected deaths`,
    excess     = `Excess deaths`,
    pct_change = `Change from expected deaths [%]`
  ) |>
  mutate(
    year     = as.integer(year),
    sex      = if_else(sex == "All people", "Both Sexes", sex),
    age_band = assign_age_band(age_group)
  ) |>
  filter(year >= 2015 & year <= 2024)


#  Table 7: Years of Life Lost (YLL) 
# NOTE: All numeric columns arrive as character type from the raw Excel file.
#       Explicit coercion to numeric is applied here to fix this.
deaths_years_life_lost <- deaths_years_life_lost |>
  rename(
    year       = `Year of registration`,
    sex        = Sex,
    age_group  = `Age group (years)`,
    cause      = `Cause of death`,
    icd10_code = `ICD-10 code`,
    deaths     = `Number of deaths`,
    crude_rate = `Crude mortality rate (per 100,000)`,
    mean_age   = `Mean age at death`,
    yll_16_64  = `YLL, aged 16 to 64 years (Thousands)`,
    yll_u75    = `YLL, aged under 75 years (Thousands)`,
    yll_rate   = `Crude rate of YLL, aged under 75 years (per 100,000)`
  ) |>
  mutate(
    year       = as.integer(year),
    sex        = if_else(sex == "All people", "Both Sexes", sex),
    age_band   = assign_age_band_numeric(age_group),
    # Fix: coerce character columns to numeric
    yll_u75    = suppressWarnings(as.numeric(yll_u75)),
    yll_16_64  = suppressWarnings(as.numeric(yll_16_64)),
    yll_rate   = suppressWarnings(as.numeric(yll_rate)),
    deaths     = suppressWarnings(as.numeric(deaths)),
    crude_rate = suppressWarnings(as.numeric(crude_rate)),
    mean_age   = suppressWarnings(as.numeric(mean_age))
  ) |>
  filter(year >= 2015 & year <= 2024)



# SECTION 5: Save Cleaned Datasets to data/processed/
write_csv(deaths_by_cause_place,     "data/processed/deaths_by_cause_place.csv")
write_csv(deaths_by_region,          "data/processed/deaths_by_region.csv")
write_csv(deaths_by_age_marital,     "data/processed/deaths_by_age_marital.csv")
write_csv(deaths_age_specific_rates, "data/processed/deaths_age_specific_rates.csv")
write_csv(deaths_by_month,           "data/processed/deaths_by_month.csv")
write_csv(deaths_years_life_lost,    "data/processed/deaths_years_life_lost.csv")


# SECTION 6: EXPLORATORY DATA ANALYSIS (EDA)
# 6.1: Identify Top 10 Causes of Death (2015–2024 combined)
# Exclusion logic removes summary rows to prevent double-counting:
#   - "Both Sexes" (would duplicate Male + Female)
#   - "All Ages" / "All ages" (would duplicate individual age groups)
#   - "All places" (would duplicate individual place categories)
#   - "All Causes" (the grand total row)

top10_causes <- deaths_by_cause_place |>
  filter(
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places",
    cause_short != "All Causes"
  ) |>
  group_by(cause_short, icd10_code) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
  arrange(desc(total_deaths)) |>
  slice_head(n = 10)

print(top10_causes)

# 6.2: Visualise Top 10 Causes of Death (Horizontal Bar Chart)

top10_causes |>
  ggplot(aes(x = reorder(cause_short, total_deaths),
             y = total_deaths,
             fill = cause_short)) +
  geom_col(show.legend = FALSE) +
  coord_flip() +
  scale_y_continuous(labels = scales::comma) +
  labs(
    title    = "Top 10 Causes of Death in England & Wales (2015–2024)",
    subtitle = "Total deaths over 10 years, all ages and sexes combined",
    x        = NULL,
    y        = "Total Deaths",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 13) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank()
  )

# 6.3: Top Causes of Death — Trend Over Time (2015–2024)
# Line chart showing annual trajectory of each top-10 cause

causes_by_year <- deaths_by_cause_place |>
  filter(
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places",
    cause_short != "All Causes",
    cause_short %in% top10_causes$cause_short
  ) |>
  group_by(year, cause_short) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")

causes_by_year |>
  ggplot(aes(x = year, y = total_deaths, colour = cause_short)) +
  geom_line(linewidth = 1) +
  geom_point(size = 2) +
  scale_y_continuous(labels = scales::comma) +
  scale_x_continuous(breaks = 2015:2024) +
  labs(
    title    = "Trends in Top 10 Causes of Death, England & Wales (2015–2024)",
    subtitle = "Annual deaths by cause",
    x        = "Year",
    y        = "Total Deaths",
    colour   = "Cause",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank(),
    legend.position  = "right"
  )

# 6.4: Deaths by Age Band and Cause (Stacked Bar Chart)
# Shows how mortality burden distributes across life stages

deaths_by_ageband <- deaths_by_cause_place |>
  filter(
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places",
    cause_short != "All Causes",
    cause_short %in% top10_causes$cause_short
  ) |>
  group_by(age_band, cause_short) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")

age_order <- c("Neonates", "Infants & Toddlers", "Children",
               "Young Adults", "Middle Aged", "Older Adults", "Seniors", "Elderly")

deaths_by_ageband |>
  mutate(age_band = factor(age_band, levels = age_order)) |>
  ggplot(aes(x = age_band, y = total_deaths, fill = cause_short)) +
  geom_col(position = "stack") +
  scale_y_continuous(labels = scales::comma) +
  labs(
    title    = "Deaths by Age Group & Cause, England & Wales (2015–2024)",
    subtitle = "Total deaths over 10 years by age band and cause of death",
    x        = "Age Group",
    y        = "Total Deaths",
    fill     = "Cause",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank(),
    axis.text.x      = element_text(angle = 30, hjust = 1)
  )

# 6.5: Deaths by Sex and Cause (Grouped Bar Chart)
# Highlights sex differences across leading causes

deaths_by_sex <- deaths_by_cause_place |>
  filter(
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places",
    cause_short != "All Causes",
    cause_short %in% top10_causes$cause_short
  ) |>
  group_by(sex, cause_short) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")

deaths_by_sex |>
  ggplot(aes(x = reorder(cause_short, total_deaths),
             y = total_deaths,
             fill = sex)) +
  geom_col(position = "dodge") +
  coord_flip() +
  scale_y_continuous(labels = scales::comma) +
  scale_fill_manual(values = c("Male" = "#2196F3", "Female" = "#E91E63")) +
  labs(
    title    = "Deaths by Cause and Sex, England & Wales (2015–2024)",
    subtitle = "Comparison of total deaths between males and females",
    x        = NULL,
    y        = "Total Deaths",
    fill     = "Sex",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank()
  )

# 6.6: Deaths by Place of Occurrence (Bar Chart)
# Shows where deaths happen: NHS hospital, home, care home, hospice etc.

deaths_by_place <- deaths_by_cause_place |>
  filter(
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places",
    cause_short != "All Causes"
  ) |>
  group_by(place) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
  arrange(desc(total_deaths))

deaths_by_place |>
  ggplot(aes(x = reorder(place, total_deaths),
             y = total_deaths,
             fill = place)) +
  geom_col(show.legend = FALSE) +
  coord_flip() +
  scale_y_continuous(labels = scales::comma) +
  labs(
    title    = "Deaths by Place of Occurrence, England & Wales (2015–2024)",
    subtitle = "Total deaths over 10 years by place of death",
    x        = NULL,
    y        = "Total Deaths",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank()
  )

# 6.7: Total Deaths by Year (2015–2024) — Line Chart
# Reveals overall mortality trend including COVID-19 spike in 2020

deaths_by_year <- deaths_by_cause_place |>
  filter(
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places",
    cause_short != "All Causes"
  ) |>
  group_by(year) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")

deaths_by_year |>
  ggplot(aes(x = year, y = total_deaths)) +
  geom_line(colour = "#2196F3", linewidth = 1.2) +
  geom_point(colour = "#2196F3", size = 3) +
  geom_text(aes(label = scales::comma(total_deaths)),
            vjust = -1, size = 3.2, colour = "grey30") +
  scale_y_continuous(labels = scales::comma,
                     limits = c(400000, 700000)) +
  scale_x_continuous(breaks = 2015:2024) +
  labs(
    title    = "Total Deaths per Year, England & Wales (2015–2024)",
    subtitle = "Annual registered deaths — COVID-19 impact clearly visible in 2020",
    x        = "Year",
    y        = "Total Deaths",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank()
  )


# SECTION 7: EPIDEMIC CURVES

# 7.1: Monthly Mortality Trend — Actual vs Expected Deaths (2015–2024)
# Bar chart of observed monthly deaths with expected baseline overlaid
# Demonstrates seasonal winter peaks and COVID-19 excess in 2020

monthly_trend <- deaths_by_month |>
  filter(
    month    != "All months",
    sex      != "Both Sexes",
    age_band != "All Ages"
  ) |>
  mutate(
    month = factor(month, levels = c("January", "February", "March",
                                     "April", "May", "June", "July",
                                     "August", "September", "October",
                                     "November", "December")),
    date = as.Date(paste(year, month, "01"), format = "%Y %B %d")
  ) |>
  group_by(date, year, month) |>
  summarise(
    total_deaths    = sum(deaths,   na.rm = TRUE),
    expected_deaths = sum(expected, na.rm = TRUE),
    .groups = "drop"
  )

monthly_trend |>
  ggplot(aes(x = date)) +
  geom_col(aes(y = total_deaths), fill = "#90CAF9", alpha = 0.7) +
  geom_line(aes(y = expected_deaths), colour = "#B71C1C",
            linewidth = 0.8, linetype = "dashed") +
  scale_x_date(date_breaks = "1 year", date_labels = "%Y") +
  scale_y_continuous(labels = scales::comma) +
  annotate("text", x = as.Date("2020-06-01"), y = 90000,
           label = "COVID-19 Peak\n2020", size = 3,
           colour = "#B71C1C", fontface = "bold") +
  labs(
    title    = "Monthly Mortality Trend, England & Wales (2015–2024)",
    subtitle = "Blue bars = actual deaths  |  Red dashed line = expected baseline deaths",
    x        = "Date",
    y        = "Total Deaths",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank(),
    axis.text.x      = element_text(angle = 45, hjust = 1)
  )


# 7.2: COVID-19 Epidemic Curve — Excess Deaths (2020–2024)
# True epi curve: positive excess = above baseline (red), negative = below (blue)
# Annotated with wave labels based on observed peaks

covid_epi_curve <- deaths_by_month |>
  filter(
    month    != "All months",
    sex      != "Both Sexes",
    age_band != "All Ages"
  ) |>
  mutate(
    month = factor(month, levels = c("January", "February", "March",
                                     "April", "May", "June", "July",
                                     "August", "September", "October",
                                     "November", "December")),
    date = as.Date(paste(year, month, "01"), format = "%Y %B %d")
  ) |>
  group_by(date, year, month) |>
  summarise(
    total_deaths  = sum(deaths, na.rm = TRUE),
    excess_deaths = sum(excess, na.rm = TRUE),
    .groups = "drop"
  ) |>
  filter(year >= 2020)

covid_epi_curve |>
  ggplot(aes(x = date, y = excess_deaths)) +
  geom_col(aes(fill = excess_deaths > 0), show.legend = FALSE) +
  scale_fill_manual(values = c("TRUE" = "#B71C1C", "FALSE" = "#1565C0")) +
  scale_x_date(date_breaks = "3 months", date_labels = "%b %Y") +
  scale_y_continuous(labels = scales::comma) +
  geom_hline(yintercept = 0, linetype = "dashed", colour = "grey40") +
  annotate("text", x = as.Date("2020-04-01"), y = 44000,
           label = "Wave 1", size = 3.5, fontface = "bold", colour = "#B71C1C") +
  annotate("text", x = as.Date("2021-01-01"), y = 23000,
           label = "Wave 2", size = 3.5, fontface = "bold", colour = "#B71C1C") +
  annotate("text", x = as.Date("2022-01-01"), y = 11000,
           label = "Wave 3+", size = 3.5, fontface = "bold", colour = "#B71C1C") +
  labs(
    title    = "COVID-19 Epidemic Curve — Excess Deaths, England & Wales (2020–2024)",
    subtitle = "Monthly excess deaths above expected baseline  |  Red = above expected  |  Blue = below expected",
    x        = "Date",
    y        = "Excess Deaths",
    caption  = "Source: ONS Annual Deaths Registration Data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank(),
    axis.text.x      = element_text(angle = 45, hjust = 1)
  )


# SECTION 8: Rt CALCULATION & TRACKER
# Rt = effective reproduction number
#   Rt > 1 → deaths increasing (epidemic growing)
#   Rt < 1 → deaths declining (epidemic contracting)
# Method: EpiEstim parametric serial interval (SI)

# 8.1: All-Cause Monthly Rt (2015–2024)
# Input:  monthly all-cause death counts (n = 120 months)
# Serial interval: mean_si = 2 months, std_si = 1 month (approximation)
# Output: rt_results — tidy dataframe with date, rt_mean, rt_lower, rt_upper

rt_input <- deaths_by_month |>
  filter(
    month    != "All months",
    sex      == "Both Sexes",
    age_band == "All Ages"
  ) |>
  mutate(date = as.Date(paste(year, month, "01"), format = "%Y %B %d")) |>
  group_by(date) |>
  summarise(
    total_deaths  = sum(deaths, na.rm = TRUE),
    excess_deaths = sum(excess, na.rm = TRUE),
    .groups = "drop"
  ) |>
  arrange(date)

rt_data   <- rt_input |> mutate(incidence = pmax(total_deaths, 0))
config    <- make_config(mean_si = 2, std_si = 1)

rt_estimate <- estimate_R(
  incid  = rt_data$incidence,
  method = "parametric_si",
  config = config
)

# Extract into clean tidy dataframe
rt_results <- rt_estimate$R |>
  as_tibble() |>
  mutate(
    date     = rt_data$date[t_end],
    rt_mean  = `Mean(R)`,
    rt_lower = `Quantile.0.025(R)`,
    rt_upper = `Quantile.0.975(R)`
  ) |>
  select(date, rt_mean, rt_lower, rt_upper)

# Plot all-cause monthly Rt tracker
rt_results |>
  ggplot(aes(x = date)) +
  geom_ribbon(aes(ymin = rt_lower, ymax = rt_upper),
              fill = "#90CAF9", alpha = 0.4) +
  geom_line(aes(y = rt_mean), colour = "#1565C0", linewidth = 1) +
  geom_hline(yintercept = 1, linetype = "dashed",
             colour = "#B71C1C", linewidth = 0.8) +
  annotate("text", x = as.Date("2020-05-01"), y = 1.15,
           label = "COVID-19\nWave 1", size = 3.2,
           colour = "#B71C1C", fontface = "bold") +
  annotate("text", x = as.Date("2021-01-01"), y = 1.15,
           label = "Wave 2", size = 3.2,
           colour = "#B71C1C", fontface = "bold") +
  scale_x_date(date_breaks = "1 year", date_labels = "%Y") +
  scale_y_continuous(breaks = seq(0.8, 1.3, by = 0.1)) +
  labs(
    title    = "Rt Tracker — All-Cause Monthly Mortality, England & Wales (2015–2024)",
    subtitle = "Shaded band = 95% credible interval  |  Rt > 1 = deaths increasing  |  Rt < 1 = deaths declining",
    x        = "Date",
    y        = "Rt (Effective Reproduction Number)",
    caption  = "Source: ONS Annual Deaths Registration Data  |  Calculated using EpiEstim (parametric SI)"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank(),
    axis.text.x      = element_text(angle = 45, hjust = 1)
  )

# 8.2: Infectious Cause Annual Rt (2022–2024)
# Uses annual incidence per cause; SI mean = 2 years, SD = 1 year
# Limitation: only 3 years available (2022–2024) due to SI window requirement
# Causes analysed: Infectious & Parasitic, Respiratory, Special Purposes/COVID

infectious_causes <- c("Infectious & Parasitic Diseases",
                       "Respiratory Diseases",
                       "Special Purposes & COVID")

infectious_annual <- deaths_by_cause_place |>
  filter(
    cause_short %in% infectious_causes,
    sex         != "Both Sexes",
    age_band    != "All Ages",
    place       != "All places"
  ) |>
  group_by(year, cause_short) |>
  summarise(incidence = sum(deaths, na.rm = TRUE), .groups = "drop") |>
  arrange(cause_short, year)

# Helper: calculate Rt for a single cause given incidence vector and date vector
calc_rt <- function(incidence_vec, dates_vec) {
  config <- make_config(mean_si = 2, std_si = 1)
  rt_est <- estimate_R(
    incid  = pmax(incidence_vec, 1),
    method = "parametric_si",
    config = config
  )
  rt_est$R |>
    as_tibble() |>
    mutate(
      date     = dates_vec[t_end],
      rt_mean  = `Mean(R)`,
      rt_lower = `Quantile.0.025(R)`,
      rt_upper = `Quantile.0.975(R)`
    ) |>
    select(date, rt_mean, rt_lower, rt_upper)
}

# Apply across all infectious causes
rt_by_cause <- infectious_annual |>
  group_by(cause_short) |>
  group_modify(~ calc_rt(.x$incidence, as.Date(paste0(.x$year, "-01-01")))) |>
  ungroup()

print(rt_by_cause)

# 8.3: Combined Rt Chart — All-Cause Monthly + Infectious Cause Annual
# Contextualises infectious disease Rt against overall mortality Rt
# NB: different temporal resolutions — annual points overlaid on monthly line

rt_all_cause <- rt_results |> mutate(cause_short = "All Causes (Monthly)")
rt_combined  <- bind_rows(rt_all_cause, rt_by_cause)

rt_combined |>
  ggplot(aes(x = date, y = rt_mean, colour = cause_short)) +
  geom_line(data = filter(rt_combined, cause_short == "All Causes (Monthly)"),
            linewidth = 0.8, alpha = 0.7) +
  geom_line(data = filter(rt_combined, cause_short != "All Causes (Monthly)"),
            linewidth = 1.2) +
  geom_point(data = filter(rt_combined, cause_short != "All Causes (Monthly)"),
             size = 3) +
  geom_hline(yintercept = 1, linetype = "dashed", colour = "black", linewidth = 0.7) +
  scale_x_date(date_breaks = "1 year", date_labels = "%Y") +
  scale_colour_manual(values = c(
    "All Causes (Monthly)"            = "#90CAF9",
    "Infectious & Parasitic Diseases" = "#2E7D32",
    "Respiratory Diseases"            = "#7B1FA2",
    "Special Purposes & COVID"        = "#B71C1C"
  )) +
  annotate("text", x = as.Date("2019-06-01"), y = 0.87,
           label = "Note: Infectious cause Rt based\non annual data (2022–2024 only)",
           size = 2.8, colour = "grey40", fontface = "italic") +
  labs(
    title    = "Rt Tracker — All Causes & Infectious Diseases, England & Wales",
    subtitle = "Rt > 1 = deaths increasing  |  Rt < 1 = deaths declining  |  Dashed line = threshold (1.0)",
    x        = "Date",
    y        = "Rt (Effective Reproduction Number)",
    colour   = "Cause",
    caption  = "Source: ONS  |  All-cause: monthly data  |  Infectious causes: annual data"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title       = element_text(face = "bold"),
    plot.subtitle    = element_text(colour = "grey40"),
    panel.grid.minor = element_blank(),
    axis.text.x      = element_text(angle = 45, hjust = 1),
    legend.position  = "right"
  )


# SECTION 9: REGIONAL ANALYSIS & CHOROPLETH MAPS
# Uses ONS Regions (December 2022) EN BGC shapefile — 9 regions
# North/South divide: North East & North West have highest ASMR;
#                     London & South East have lowest

# Load ONS regions shapefile (generalised boundary)
england_regions_ons <- st_read("data/external/england_region_ons.geojson", quiet = TRUE)

cat("Shapefile region names:\n")
print(england_regions_ons$RGN22NM)

# 9.1: Prepare Aggregated Regional Deaths Data (2015–2024 combined)
regional_deaths <- deaths_by_region |>
  filter(geography == "Region", sex == "Both Sexes") |>
  group_by(area_code, area_name) |>
  summarise(
    total_deaths = sum(deaths, na.rm = TRUE),
    avg_asmr     = mean(asmr,  na.rm = TRUE),
    .groups = "drop"
  ) |>
  mutate(
    area_name = str_to_title(area_name),
    # Harmonise names to exactly match ONS shapefile labels
    area_name = case_when(
      area_name == "Yorkshire And The Humber" ~ "Yorkshire and The Humber",
      area_name == "East"                     ~ "East of England",
      TRUE                                    ~ area_name
    )
  )

# Join deaths data to shapefile
regions_map_data <- england_regions_ons |>
  left_join(regional_deaths, by = c("RGN22NM" = "area_name"))

# Confirm all 9 regions matched (no NAs in total_deaths)
regions_map_data |>
  select(RGN22NM, total_deaths, avg_asmr) |>
  st_drop_geometry() |>
  print()


# 9.2: Static Choropleth Map — Average ASMR across 2015–2024
# Hover for region name, total deaths, and average ASMR

pal_static <- colorNumeric(palette = "YlOrRd", domain = regions_map_data$avg_asmr)

leaflet(regions_map_data) |>
  addProviderTiles(providers$CartoDB.Positron) |>
  addPolygons(
    fillColor   = ~pal_static(avg_asmr),
    fillOpacity = 0.7,
    color       = "pink",
    weight      = 2,
    highlight   = highlightOptions(
      weight = 3, color = "#666", fillOpacity = 0.9, bringToFront = TRUE
    ),
    label = ~paste0(
      "<b>", RGN22NM, "</b><br>",
      "Total Deaths (2015–2024): ", scales::comma(total_deaths), "<br>",
      "Avg ASMR: ", round(avg_asmr, 1), " per 100,000"
    ) |> lapply(htmltools::HTML),
    popup = ~paste0(
      "<b>Region: ", RGN22NM, "</b><br>",
      "Total Deaths: ", scales::comma(total_deaths), "<br>",
      "Age-Standardised Mortality Rate: ", round(avg_asmr, 1), " per 100,000"
    ) |> lapply(htmltools::HTML)
  ) |>
  addLegend(
    pal = pal_static, values = ~avg_asmr,
    position = "bottomright",
    title = "Avg ASMR<br>(per 100,000)"
  ) |>
  addControl(
    html = "<b>Mortality by Region, England (2015–2024 Average)</b>",
    position = "topright"
  )

# 9.3: Prepare Regional Deaths by Year (used in Shiny map and dashboard)

regional_deaths_by_year <- deaths_by_region |>
  filter(geography == "Region", sex == "Both Sexes") |>
  mutate(
    area_name = str_to_title(area_name),
    area_name = case_when(
      area_name == "Yorkshire And The Humber" ~ "Yorkshire and The Humber",
      area_name == "East"                     ~ "East of England",
      TRUE                                    ~ area_name
    )
  ) |>
  group_by(year, area_name, area_code) |>
  summarise(
    total_deaths = sum(deaths, na.rm = TRUE),
    avg_asmr     = mean(asmr,  na.rm = TRUE),
    .groups = "drop"
  )

# Join to shapefile for use in Shiny slider map (used in dashboard.R)
regions_year_data <- england_regions_ons |>
  left_join(regional_deaths_by_year, by = c("RGN22NM" = "area_name"))


# END OF ANALYSIS SCRIPT
# dashboard.R next to launch the interactive Shiny dashboard

install.packages("forecast")
library(forecast)
