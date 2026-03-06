if (Sys.getenv("SHINY_PORT") == "") {
  setwd("/cloud/project")  # local RStudio
}

# PROJECT:     Public & Population Health — England & Wales Mortality Dashboard
# File:        dashboard.R

library(shiny)
library(shinydashboard)
library(shinyWidgets)
library(tidyverse)
library(leaflet)
library(sf)
library(plotly)
library(scales)
library(htmltools)
library(EpiEstim)
library(forecast)

# SECTION 2: LOAD & PREPARE DATA

deaths_by_cause_place     <- read_csv("data/processed/deaths_by_cause_place.csv",     show_col_types = FALSE)
deaths_by_region          <- read_csv("data/processed/deaths_by_region.csv",          show_col_types = FALSE)
deaths_by_age_marital     <- read_csv("data/processed/deaths_by_age_marital.csv",     show_col_types = FALSE)
deaths_age_specific_rates <- read_csv("data/processed/deaths_age_specific_rates.csv", show_col_types = FALSE)
deaths_by_month           <- read_csv("data/processed/deaths_by_month.csv",           show_col_types = FALSE)
deaths_years_life_lost    <- read_csv("data/processed/deaths_years_life_lost.csv",    show_col_types = FALSE)

deaths_years_life_lost <- deaths_years_life_lost |>
  mutate(
    year       = as.integer(year),
    yll_u75    = suppressWarnings(as.numeric(yll_u75)),
    yll_16_64  = suppressWarnings(as.numeric(yll_16_64)),
    yll_rate   = suppressWarnings(as.numeric(yll_rate)),
    deaths     = suppressWarnings(as.numeric(deaths)),
    crude_rate = suppressWarnings(as.numeric(crude_rate)),
    mean_age   = suppressWarnings(as.numeric(mean_age))
  )

england_regions_ons <- st_read("data/external/england_region_ons.geojson", quiet = TRUE)

top10_causes <- deaths_by_cause_place |>
  filter(sex != "Both Sexes", !is.na(age_band), age_band != "All Ages",
         place != "All places", cause_short != "All Causes") |>
  group_by(cause_short) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
  arrange(desc(total_deaths)) |> slice_head(n = 10)

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
  summarise(total_deaths = sum(deaths, na.rm = TRUE), avg_asmr = mean(asmr, na.rm = TRUE), .groups = "drop")

# England-wide total deaths by year (for region scaling factor)
england_total_by_year <- deaths_by_region |>
  filter(geography == "Country", sex == "Both Sexes") |>
  group_by(year) |>
  summarise(england_total = sum(deaths, na.rm = TRUE), .groups = "drop")

regions_year_data <- england_regions_ons |>
  left_join(regional_deaths_by_year, by = c("RGN22NM" = "area_name"))

rt_input <- deaths_by_month |>
  filter(month != "All months", sex == "Both Sexes", age_band == "All Ages") |>
  mutate(date = as.Date(paste(year, month, "01"), format = "%Y %B %d")) |>
  group_by(date) |>
  summarise(total_deaths = sum(deaths, na.rm = TRUE), excess_deaths = sum(excess, na.rm = TRUE), .groups = "drop") |>
  arrange(date)

rt_data     <- rt_input |> mutate(incidence = pmax(total_deaths, 0))
rt_config   <- make_config(mean_si = 2, std_si = 1)
rt_estimate <- estimate_R(incid = rt_data$incidence, method = "parametric_si", config = rt_config)
rt_results  <- rt_estimate$R |>
  as_tibble() |>
  mutate(date = rt_data$date[t_end], rt_mean = `Mean(R)`,
         rt_lower = `Quantile.0.025(R)`, rt_upper = `Quantile.0.975(R)`) |>
  select(date, rt_mean, rt_lower, rt_upper)

all_regions  <- sort(unique(regional_deaths_by_year$area_name))
all_counties <- deaths_by_region |>
  filter(geography %in% c("County", "Unitary Authority", "Metropolitan County")) |>
  distinct(area_name) |> arrange(area_name) |> pull(area_name)
all_causes <- sort(unique(deaths_by_cause_place$cause_short[deaths_by_cause_place$cause_short != "All Causes"]))
age_order  <- c("Neonates","Infants & Toddlers","Children","Young Adults","Middle Aged","Older Adults","Seniors","Elderly")

# Helper: abbreviate numbers for in-chart labels
abbr_num <- function(x) {
  dplyr::case_when(
    abs(x) >= 1e6  ~ paste0(round(x/1e6, 1), "M"),
    abs(x) >= 1e3  ~ paste0(round(x/1e3, 0), "K"),
    TRUE           ~ as.character(round(x, 0))
  )
}

# SECTION 3: UI

ui <- dashboardPage(
  skin = "blue",
  dashboardHeader(
    title      = span(icon("heartbeat"), " England & Wales Mortality"),
    titleWidth = 320,
    # ← PASTE THE tags$li CREDIT HERE
    tags$li(
      class = "dropdown",
      tags$a(
        style = "color:white; padding-top:15px; padding-right:20px; font-size:12px; opacity:0.8;",
        "Developed by Temi-Priscilla Jokotola"
      )
    )
  ),
  
  dashboardSidebar(
    width = 285,
    sidebarMenu(
      id = "tabs",
      menuItem("Overview",          tabName = "overview",     icon = icon("chart-bar")),
      menuItem("Demographics",      tabName = "demographics", icon = icon("users")),
      menuItem("Epidemic Analysis", tabName = "epidemic",     icon = icon("virus")),
      menuItem("Regional Maps",     tabName = "maps",         icon = icon("map")),
      menuItem("Causes Deep Dive",  tabName = "causes",       icon = icon("stethoscope")),
      menuItem("Predictions",        tabName = "predictions",  icon = icon("chart-line"))
    ),
    hr(),
    tags$p("🔍 Global Filters", style = "padding-left:15px; color:#aaa; font-weight:bold; margin-bottom:5px;"),
    sliderInput("year_range", "Year Range:", min = 2015, max = 2024, value = c(2015, 2024), step = 1, sep = ""),
    pickerInput("region_filter", "Region:", choices = c("All Regions", all_regions), selected = "All Regions",
                options = list(`live-search` = TRUE)),
    pickerInput("county_filter", "County / Unitary Authority:", choices = c("All Counties", all_counties),
                selected = "All Counties", options = list(`live-search` = TRUE)),
    radioButtons("sex_filter", "Sex:", choices = c("Both Sexes","Male","Female"), selected = "Both Sexes", inline = TRUE),
    pickerInput("cause_filter", "Cause of Death:", choices = c("All Causes", all_causes), selected = "All Causes",
                options = list(`live-search` = TRUE)),
    br(),
    tags$p("Source: ONS Annual Deaths Registration Data (2015–2024)",
           style = "padding-left:15px; color:#888; font-size:11px;")
  ),
  
  dashboardBody(
    tags$head(tags$style(HTML("
      .skin-blue .main-header .logo { background-color:#1a237e; font-weight:bold; font-size:15px; }
      .skin-blue .main-header .navbar { background-color:#283593; }
      .skin-blue .main-sidebar { background-color:#1c2331; }
      .skin-blue .sidebar-menu > li.active > a { background-color:#283593; border-left:3px solid #42a5f5; }
      .skin-blue .sidebar-menu > li > a:hover { background-color:#283593; }
      .content-wrapper { background-color:#f4f6f9; }
      .box { border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
      .box-header { border-radius:8px 8px 0 0; }
      .small-box { border-radius:8px; }
      .small-box .inner p { font-size:13px !important; word-wrap:break-word; white-space:normal; line-height:1.3; }
      .small-box .inner h3 { font-size:22px !important; word-wrap:break-word; white-space:normal; }
      .tab-desc { background:#fff; border-left:4px solid #283593; padding:8px 14px; border-radius:4px; margin-bottom:12px; color:#444; font-size:13px; }
    "))),
    
    tabItems(
      
      # TAB 1: OVERVIEW 
      tabItem(tabName = "overview",
              div(class = "tab-desc", "📊 Summary of England & Wales mortality (2015–2024). Region filter scales cause-based charts proportionally."),
              fluidRow(
                valueBoxOutput("kpi_total_deaths", width = 3),
                valueBoxOutput("kpi_top_cause",    width = 3),
                valueBoxOutput("kpi_peak_year",    width = 3),
                valueBoxOutput("kpi_avg_asmr",     width = 3)
              ),
              fluidRow(
                box(title = "Top 10 Causes of Death", status = "primary", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_top10", height = "400px")),
                box(title = "Total Deaths by Year",   status = "primary", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_yearly", height = "400px"))
              ),
              fluidRow(
                box(title = "Top Causes Trend Over Time (2015–2024)", status = "info", solidHeader = TRUE, width = 12,
                    plotlyOutput("plot_trends", height = "370px"))
              )
      ),
      
      # TAB 2: DEMOGRAPHICS 
      tabItem(tabName = "demographics",
              div(class = "tab-desc", "👥 Breakdown of deaths by age group, sex, and place of occurrence."),
              fluidRow(
                box(title = "Deaths by Age Group & Cause", status = "primary", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_age", height = "420px")),
                box(title = "Deaths by Sex & Cause",       status = "primary", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_sex", height = "420px"))
              ),
              fluidRow(
                box(title = "Age-Specific Mortality Rates by Age Band", status = "info", solidHeader = TRUE, width = 5,
                    plotlyOutput("plot_asmr", height = "370px")),
                box(title = "Deaths by Place of Occurrence",           status = "info", solidHeader = TRUE, width = 7,
                    plotlyOutput("plot_place", height = "370px"))
              )
      ),
      
      # TAB 3: EPIDEMIC 
      tabItem(tabName = "epidemic",
              div(class = "tab-desc", "🦠 COVID-19 excess deaths, seasonal mortality trends, and the Rt tracker."),
              fluidRow(
                box(title = "COVID-19 Epidemic Curve — Monthly Excess Deaths (2020–2024)",
                    status = "danger", solidHeader = TRUE, width = 12,
                    plotlyOutput("plot_covid_epi", height = "370px"))
              ),
              fluidRow(
                box(title = "Monthly Mortality — Actual vs Expected Baseline",
                    status = "warning", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_monthly", height = "370px")),
                box(title = "Rt Tracker — Effective Reproduction Number (All Causes)",
                    status = "warning", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_rt", height = "370px"))
              )
      ),
      
      # TAB 4: MAPS 
      tabItem(tabName = "maps",
              div(class = "tab-desc", "🗺️ Interactive choropleth map of England by ONS region."),
              fluidRow(
                column(3,
                       box(title = "Map Controls", status = "primary", solidHeader = TRUE, width = 12,
                           sliderInput("map_year", "Select Year:", min = 2015, max = 2024, value = 2024, step = 1, sep = ""),
                           radioButtons("map_metric", "Colour Map By:",
                                        choices = c("ASMR" = "avg_asmr", "Total Deaths" = "total_deaths"), selected = "avg_asmr"),
                           hr(),
                           tags$p("ℹ️ Hover over a region for detail.", style = "color:#888; font-size:12px;")
                       )
                ),
                column(9,
                       box(title = "Mortality Choropleth Map — England by ONS Region",
                           status = "primary", solidHeader = TRUE, width = 12,
                           leafletOutput("map_regional", height = "540px"))
                )
              ),
              fluidRow(
                box(title = "Regional Deaths Comparison by Year", status = "info", solidHeader = TRUE, width = 12,
                    plotlyOutput("plot_region_bar", height = "370px"))
              )
      ),
      
      # TAB 5: CAUSES 
      tabItem(tabName = "causes",
              div(class = "tab-desc", "🔬 Detailed cause of death analysis. Use the cause filter in the sidebar."),
              fluidRow(
                box(title = "Cause Share — Proportion of All Deaths",  status = "primary", solidHeader = TRUE, width = 4,
                    plotlyOutput("plot_cause_pie", height = "420px")),
                box(title = "Deaths by Cause & Place of Occurrence",   status = "primary", solidHeader = TRUE, width = 8,
                    plotlyOutput("plot_cause_place", height = "420px"))
              ),
              fluidRow(
                box(title = "Years of Life Lost (YLL, Under 75) — Top 10 Causes",
                    status = "danger", solidHeader = TRUE, width = 12,
                    tags$p("YLL weights deaths by years lost before age 75. Higher YLL = greater premature mortality burden.",
                           style = "color:#555; font-size:12px; margin-bottom:8px;"),
                    plotlyOutput("plot_yll", height = "420px"))
              )
      )
      
      ,
      
      # TAB 6: PREDICTIONS 
      tabItem(tabName = "predictions",
              
              # Disclaimer banner
              div(
                style = "background:#fff3cd; border-left:5px solid #ff9800; padding:12px 16px;
                   border-radius:4px; margin-bottom:16px; color:#5d4037; font-size:13px;",
                icon("triangle-exclamation", style = "color:#ff9800; margin-right:6px;"),
                tags$b("Statistical Forecasting Notice: "),
                "These projections are statistical extrapolations based on historical patterns (2015–2024) only.
           They do not account for future pandemics, new treatments, policy changes, demographic shifts,
           or any other unforeseen events. Forecasts should be interpreted with caution and are intended
           for exploratory purposes only, not clinical or policy decision-making."
              ),
              
              fluidRow(
                column(3,
                       box(title = "Forecast Controls", status = "primary", solidHeader = TRUE, width = 12,
                           sliderInput("forecast_horizon", "Years to Forecast Ahead:",
                                       min = 1, max = 5, value = 3, step = 1),
                           hr(),
                           pickerInput("forecast_cause", "Cause for Cause-Specific Forecast:",
                                       choices  = c("All Causes Combined", sort(unique(
                                         deaths_by_cause_place$cause_short[deaths_by_cause_place$cause_short != "All Causes"]
                                       ))),
                                       selected = "All Causes Combined",
                                       options  = list(`live-search` = TRUE)),
                           hr(),
                           tags$p("📌 Models use auto.arima fitted on 2015–2024 annual data.
                      Shaded bands show 80% and 95% prediction intervals.",
                                  style = "color:#888; font-size:11px; line-height:1.5;")
                       )
                ),
                column(9,
                       box(title = "Overall Mortality Forecast — Total Annual Deaths",
                           status = "primary", solidHeader = TRUE, width = 12,
                           plotlyOutput("plot_forecast_total", height = "380px"))
                )
              ),
              
              fluidRow(
                box(title = "Cause-Specific Mortality Forecast",
                    status = "info", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_forecast_cause", height = "370px")),
                box(title = "Excess Mortality Forecast — Predicted vs Expected Baseline",
                    status = "warning", solidHeader = TRUE, width = 6,
                    plotlyOutput("plot_forecast_excess", height = "370px"))
              )
      )
      
    ) # end tabItems
  ) # end dashboardBody
) # end dashboardPage


# SECTION 4: SERVER

server <- function(input, output, session) {
  
  # REGION SCALING FACTOR
  # When a region is selected, calculate its share of England total deaths
  # per year, then apply that factor to scale cause-based charts proportionally.
  region_scale <- reactive({
    if (input$region_filter == "All Regions") return(1)
    
    region_deaths <- regional_deaths_by_year |>
      filter(
        area_name == input$region_filter,
        year >= input$year_range[1],
        year <= input$year_range[2]
      ) |>
      summarise(r = sum(total_deaths, na.rm = TRUE)) |> pull(r)
    
    england_deaths <- england_total_by_year |>
      filter(year >= input$year_range[1], year <= input$year_range[2]) |>
      summarise(e = sum(england_total, na.rm = TRUE)) |> pull(e)
    
    if (is.na(england_deaths) || england_deaths == 0) return(1)
    region_deaths / england_deaths
  })
  
  # REACTIVES
  
  # Base cause data (no region — scaled separately)
  filtered_cause <- reactive({
    df <- deaths_by_cause_place |>
      filter(
        year        >= input$year_range[1],
        year        <= input$year_range[2],
        !is.na(age_band),
        age_band    != "All Ages",
        place       != "All places",
        cause_short != "All Causes"
      )
    if (input$sex_filter != "Both Sexes") {
      df <- df |> filter(sex == input$sex_filter)
    } else {
      df <- df |> filter(sex != "Both Sexes")
    }
    if (input$cause_filter != "All Causes") {
      df <- df |> filter(cause_short == input$cause_filter)
    }
    df
  })
  
  # Cause data scaled by region proportion
  filtered_cause_scaled <- reactive({
    df <- filtered_cause()
    scale <- region_scale()
    df |> mutate(deaths = deaths * scale)
  })
  
  # Region data for ASMR KPI
  filtered_region <- reactive({
    df <- deaths_by_region |>
      filter(year >= input$year_range[1], year <= input$year_range[2]) |>
      mutate(area_name_title = str_to_title(area_name))
    if (input$region_filter != "All Regions") df <- df |> filter(area_name_title == input$region_filter)
    if (input$county_filter != "All Counties") df <- df |> filter(area_name == input$county_filter | area_name_title == input$county_filter)
    if (input$sex_filter != "Both Sexes") { df <- df |> filter(sex == input$sex_filter) } else { df <- df |> filter(sex == "Both Sexes") }
    df
  })
  
  # Region bar chart data
  filtered_region_bar <- reactive({
    df <- regional_deaths_by_year |>
      filter(year >= input$year_range[1], year <= input$year_range[2])
    if (input$region_filter != "All Regions") df <- df |> filter(area_name == input$region_filter)
    df
  })
  
  # KPI BOXES — all use scaled cause data
  
  output$kpi_total_deaths <- renderValueBox({
    total <- filtered_cause_scaled() |> summarise(n = sum(deaths, na.rm = TRUE)) |> pull(n)
    valueBox(abbr_num(total), "Total Deaths", icon = icon("users"), color = "blue")
  })
  
  output$kpi_top_cause <- renderValueBox({
    top <- filtered_cause_scaled() |>
      group_by(cause_short) |> summarise(n = sum(deaths, na.rm = TRUE)) |>
      arrange(desc(n)) |> slice_head(n = 1) |> pull(cause_short)
    top <- if (length(top) == 0) "N/A" else top
    valueBox(top, "Leading Cause", icon = icon("stethoscope"), color = "red")
  })
  
  output$kpi_peak_year <- renderValueBox({
    peak <- filtered_cause_scaled() |>
      group_by(year) |> summarise(n = sum(deaths, na.rm = TRUE)) |>
      arrange(desc(n)) |> slice_head(n = 1) |> pull(year)
    peak <- if (length(peak) == 0) "N/A" else peak
    valueBox(peak, "Peak Year", icon = icon("calendar"), color = "orange")
  })
  
  output$kpi_avg_asmr <- renderValueBox({
    avg <- filtered_region() |> filter(geography == "Region") |>
      summarise(avg = mean(asmr, na.rm = TRUE)) |> pull(avg)
    avg <- if (length(avg) == 0 || is.nan(avg)) "N/A" else round(avg, 1)
    valueBox(avg, "Avg ASMR (per 100,000)", icon = icon("chart-line"), color = "green")
  })
  
  # TAB 1: OVERVIEW
  
  output$plot_top10 <- renderPlotly({
    df <- filtered_cause_scaled() |>
      group_by(cause_short) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
      arrange(desc(total_deaths)) |> slice_head(n = 10) |>
      mutate(label = abbr_num(total_deaths))
    
    p <- df |>
      ggplot(aes(x = reorder(cause_short, total_deaths), y = total_deaths,
                 fill = cause_short,
                 text = paste0("<b>", cause_short, "</b><br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_col(show.legend = FALSE) +
      geom_text(aes(label = label), hjust = -0.1, size = 3.2, colour = "grey30") +
      coord_flip() +
      scale_y_continuous(labels = NULL, expand = expansion(mult = c(0, 0.15))) +
      scale_fill_brewer(palette = "Set3") +
      labs(x = NULL, y = NULL, title = "Top 10 Causes of Death") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), panel.grid.major.x = element_blank(),
            axis.text.y = element_blank(), axis.ticks.y = element_blank(),
            plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(margin = list(l = 10, r = 40))
  })
  
  output$plot_yearly <- renderPlotly({
    df <- filtered_cause_scaled() |>
      group_by(year) |> summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
      mutate(label = abbr_num(total_deaths))
    
    p <- df |>
      ggplot(aes(x = year, y = total_deaths,
                 text = paste0("Year: ", year, "<br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_line(colour = "#1565C0", linewidth = 1.3) +
      geom_point(colour = "#1565C0", size = 3.5) +
      geom_text(aes(label = label), vjust = -1.2, size = 3, colour = "grey30") +
      scale_y_continuous(labels = scales::comma, expand = expansion(mult = c(0.05, 0.15))) +
      scale_x_continuous(breaks = 2015:2024) +
      labs(x = "Year", y = "Total Deaths", title = "Annual Deaths Over Time") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text")
  })
  
  output$plot_trends <- renderPlotly({
    df <- filtered_cause_scaled() |>
      filter(cause_short %in% top10_causes$cause_short) |>
      group_by(year, cause_short) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")
    
    p <- df |>
      ggplot(aes(x = year, y = total_deaths, colour = cause_short, group = cause_short,
                 text = paste0("<b>", cause_short, "</b><br>Year: ", year,
                               "<br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_line(linewidth = 1) + geom_point(size = 2) +
      scale_y_continuous(labels = scales::comma) +
      scale_x_continuous(breaks = 2015:2024) +
      labs(x = "Year", y = "Total Deaths", colour = "Cause", title = "Top Causes Trend Over Time (2015–2024)") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(legend = list(orientation = "v", x = 1.02, y = 0.9))
  })
  
  # TAB 2: DEMOGRAPHICS
  
  output$plot_age <- renderPlotly({
    df <- filtered_cause_scaled() |>
      filter(cause_short %in% top10_causes$cause_short, !is.na(age_band), age_band != "All Ages") |>
      mutate(age_band = factor(age_band, levels = age_order)) |>
      group_by(age_band, cause_short) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")
    
    p <- df |>
      ggplot(aes(x = age_band, y = total_deaths, fill = cause_short,
                 text = paste0("<b>", cause_short, "</b><br>Age: ", age_band,
                               "<br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_col(position = "stack") +
      scale_y_continuous(labels = scales::comma) +
      labs(x = "Age Group", y = "Total Deaths", fill = "Cause", title = "Deaths by Age Group & Cause") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x = element_text(angle = 35, hjust = 1), panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(legend = list(orientation = "v", x = 1.02, y = 1))
  })
  
  output$plot_sex <- renderPlotly({
    scale <- region_scale()
    df <- deaths_by_cause_place |>
      filter(year >= input$year_range[1], year <= input$year_range[2],
             sex != "Both Sexes", !is.na(age_band), age_band != "All Ages",
             place != "All places", cause_short %in% top10_causes$cause_short) |>
      group_by(sex, cause_short) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE) * scale, .groups = "drop")
    
    p <- df |>
      ggplot(aes(x = reorder(cause_short, total_deaths), y = total_deaths, fill = sex,
                 text = paste0("<b>", cause_short, "</b><br>Sex: ", sex,
                               "<br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_col(position = "dodge") + coord_flip() +
      scale_y_continuous(labels = scales::comma) +
      scale_fill_manual(values = c("Male" = "#2196F3", "Female" = "#E91E63")) +
      labs(x = NULL, y = "Total Deaths", fill = "Sex", title = "Deaths by Sex & Cause") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(margin = list(l = 165), xaxis = list(tickangle = -30))
  })
  
  output$plot_asmr <- renderPlotly({
    df <- deaths_age_specific_rates |>
      filter(year >= input$year_range[1], year <= input$year_range[2],
             !is.na(age_band), age_band != "All Ages")
    if (input$sex_filter != "Both Sexes") df <- df |> filter(sex == input$sex_filter)
    
    df_agg <- df |>
      group_by(year, age_band) |>
      summarise(avg_rate = mean(rate, na.rm = TRUE), .groups = "drop") |>
      mutate(age_band = factor(age_band, levels = age_order))
    
    p <- df_agg |>
      ggplot(aes(x = year, y = avg_rate, colour = age_band, group = age_band,
                 text = paste0("<b>", age_band, "</b><br>Year: ", year,
                               "<br>Rate: ", round(avg_rate, 1), " per 100,000"))) +
      geom_line(linewidth = 1) + geom_point(size = 2) +
      scale_x_continuous(breaks = 2015:2024) +
      scale_y_continuous(labels = scales::comma) +
      labs(x = "Year", y = "Rate (per 100,000)", colour = "Age Band",
           title = "Age-Specific Mortality Rates Over Time") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(xaxis = list(tickangle = 45, tickfont = list(size = 10)))
  })
  
  output$plot_place <- renderPlotly({
    df <- filtered_cause_scaled() |>
      group_by(place) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
      arrange(desc(total_deaths)) |>
      mutate(label = abbr_num(total_deaths))
    
    p <- df |>
      ggplot(aes(x = reorder(place, total_deaths), y = total_deaths, fill = place,
                 text = paste0("<b>", place, "</b><br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_col(show.legend = FALSE) +
      geom_text(aes(label = label), hjust = -0.1, size = 3.2, colour = "grey30") +
      coord_flip() +
      scale_y_continuous(labels = NULL, expand = expansion(mult = c(0, 0.18))) +
      labs(x = NULL, y = NULL, title = "Deaths by Place of Occurrence") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), panel.grid.major.x = element_blank(),
            axis.text.y = element_blank(), axis.ticks.y = element_blank(),
            plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(margin = list(l = 10, r = 50))
  })
  
  # TAB 3: EPIDEMIC
  
  output$plot_covid_epi <- renderPlotly({
    df <- deaths_by_month |>
      filter(month != "All months", sex == "Both Sexes", age_band == "All Ages") |>
      mutate(month = factor(month, levels = c("January","February","March","April","May","June",
                                              "July","August","September","October","November","December")),
             date = as.Date(paste(year, month, "01"), format = "%Y %B %d")) |>
      group_by(date, year) |>
      summarise(excess_deaths = sum(excess, na.rm = TRUE), .groups = "drop") |>
      filter(year >= 2020)
    
    p <- df |>
      ggplot(aes(x = date, y = excess_deaths, fill = excess_deaths > 0,
                 text = paste0(format(date, "%b %Y"), "<br>Excess Deaths: ", scales::comma(round(excess_deaths))))) +
      geom_col(show.legend = FALSE) +
      scale_fill_manual(values = c("TRUE" = "#B71C1C", "FALSE" = "#1565C0")) +
      geom_hline(yintercept = 0, linetype = "dashed", colour = "grey50") +
      scale_x_date(date_breaks = "3 months", date_labels = "%b %Y") +
      scale_y_continuous(labels = scales::comma) +
      annotate("text", x = as.Date("2020-04-01"), y = 44000, label = "Wave 1",  fontface = "bold", colour = "#B71C1C", size = 3.5) +
      annotate("text", x = as.Date("2021-01-01"), y = 23000, label = "Wave 2",  fontface = "bold", colour = "#B71C1C", size = 3.5) +
      annotate("text", x = as.Date("2022-01-01"), y = 11000, label = "Wave 3+", fontface = "bold", colour = "#B71C1C", size = 3.5) +
      labs(x = "Date", y = "Excess Deaths",
           title = "COVID-19 Epidemic Curve — Monthly Excess Deaths (2020–2024)",
           subtitle = "Red = above expected  |  Blue = below expected") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x = element_text(angle = 45, hjust = 1), panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 12), plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text")
  })
  
  output$plot_monthly <- renderPlotly({
    # Use "Both Sexes" + "All ages" rows — these are the summary totals that
    # carry the expected/baseline figures from ONS Table 11.
    df <- deaths_by_month |>
      filter(month != "All months", sex == "Both Sexes", age_band == "All Ages") |>
      mutate(month = factor(month, levels = c("January","February","March","April","May","June",
                                              "July","August","September","October","November","December")),
             date = as.Date(paste(year, month, "01"), format = "%Y %B %d")) |>
      filter(year >= input$year_range[1], year <= input$year_range[2]) |>
      group_by(date) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), expected_deaths = sum(expected, na.rm = TRUE), .groups = "drop")
    
    p <- df |>
      ggplot(aes(x = date)) +
      geom_col(aes(y = total_deaths,
                   text = paste0(format(date, "%b %Y"), "<br>Actual: ", scales::comma(total_deaths))),
               fill = "#90CAF9", alpha = 0.8) +
      geom_line(aes(y = expected_deaths,
                    text = paste0(format(date, "%b %Y"), "<br>Expected: ", scales::comma(expected_deaths))),
                colour = "#B71C1C", linewidth = 0.9, linetype = "dashed") +
      scale_x_date(date_breaks = "1 year", date_labels = "%Y") +
      scale_y_continuous(labels = scales::comma) +
      labs(x = "Date", y = "Total Deaths", title = "Monthly Mortality — Actual vs Expected",
           subtitle = "Blue bars = actual  |  Red dashed = expected baseline") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x = element_text(angle = 45, hjust = 1), panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 12), plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text")
  })
  
  output$plot_rt <- renderPlotly({
    p <- rt_results |>
      ggplot(aes(x = date)) +
      geom_ribbon(aes(ymin = rt_lower, ymax = rt_upper), fill = "#90CAF9", alpha = 0.4) +
      geom_line(aes(y = rt_mean,
                    text = paste0(format(date, "%b %Y"), "<br>Rt: ", round(rt_mean, 3),
                                  "<br>95% CI: [", round(rt_lower, 3), " – ", round(rt_upper, 3), "]")),
                colour = "#1565C0", linewidth = 1.1) +
      geom_hline(yintercept = 1, linetype = "dashed", colour = "#B71C1C", linewidth = 0.9) +
      annotate("text", x = as.Date("2023-01-01"), y = 1.015, label = "Rt = 1.0 threshold",
               colour = "#B71C1C", size = 3, fontface = "italic") +
      scale_x_date(date_breaks = "1 year", date_labels = "%Y") +
      scale_y_continuous(breaks = seq(0.8, 1.3, 0.05)) +
      labs(x = "Date", y = "Rt", title = "Rt Tracker — All-Cause Monthly Mortality",
           subtitle = "Shaded = 95% CI  |  Rt > 1 = growing  |  Rt < 1 = declining") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x = element_text(angle = 45, hjust = 1), panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 12), plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text")
  })
  
  # TAB 4: MAPS
  
  output$map_regional <- renderLeaflet({
    df     <- regions_year_data |> filter(year == input$map_year)
    metric <- input$map_metric
    metric_label <- if (metric == "avg_asmr") "ASMR (per 100,000)" else "Total Deaths"
    
    pal <- colorNumeric(palette = "YlOrRd", domain = regions_year_data[[metric]], na.color = "#cccccc")
    
    leaflet(df) |>
      addProviderTiles(providers$CartoDB.Positron) |>
      addPolygons(
        fillColor = ~pal(get(metric)), fillOpacity = 0.75, color = "white", weight = 2, smoothFactor = 0.5,
        highlight = highlightOptions(weight = 3, color = "#333", fillOpacity = 0.92, bringToFront = TRUE),
        label = ~paste0("<b>", RGN22NM, "</b><br>Year: ", year,
                        "<br>Total Deaths: ", scales::comma(total_deaths),
                        "<br>ASMR: ", round(avg_asmr, 1), " per 100,000") |> lapply(htmltools::HTML),
        labelOptions = labelOptions(style = list("font-weight" = "normal", padding = "4px 8px"),
                                    textsize = "13px", direction = "auto")
      ) |>
      addLegend(pal = pal, values = regions_year_data[[metric]], position = "bottomright",
                title = metric_label, opacity = 0.8) |>
      addControl(html = paste0("<div style='background:white;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px;'>Mortality by Region — England, ", input$map_year, "</div>"),
                 position = "topright")
  })
  
  output$plot_region_bar <- renderPlotly({
    df <- filtered_region_bar()
    p <- df |>
      ggplot(aes(x = year, y = total_deaths, fill = area_name,
                 text = paste0("<b>", area_name, "</b><br>Year: ", year,
                               "<br>Deaths: ", scales::comma(total_deaths)))) +
      geom_col(position = "dodge") +
      scale_y_continuous(labels = scales::comma) +
      scale_x_continuous(breaks = 2015:2024) +
      labs(x = "Year", y = "Total Deaths", fill = "Region", title = "Regional Deaths Comparison by Year") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(), axis.text.x = element_text(angle = 45, hjust = 1),
            plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(legend = list(orientation = "v", x = 1.02, y = 1))
  })
  
  # TAB 5: CAUSES DEEP DIVE
  
  output$plot_cause_pie <- renderPlotly({
    df <- filtered_cause_scaled() |>
      group_by(cause_short) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
      arrange(desc(total_deaths)) |>
      mutate(
        pct   = total_deaths / sum(total_deaths) * 100,
        label = paste0(cause_short, "<br>", round(pct, 1), "%")
      )
    
    plot_ly(df,
            labels  = ~cause_short,
            values  = ~total_deaths,
            type    = "pie",
            hole    = 0.45,
            text    = ~paste0(cause_short, "<br>", scales::comma(round(total_deaths)), " deaths<br>", round(pct, 1), "%"),
            hoverinfo = "text",
            textinfo  = "none",
            marker = list(colors = RColorBrewer::brewer.pal(min(nrow(df), 12), "Set3"),
                          line = list(color = "white", width = 1.5))
    ) |>
      layout(
        title       = list(text = "Cause Share of All Deaths", font = list(size = 13, color = "#1a237e")),
        showlegend  = TRUE,
        legend      = list(orientation = "v", x = 1.0, y = 0.5, font = list(size = 10)),
        margin      = list(l = 0, r = 0, t = 40, b = 0)
      )
  })
  
  output$plot_cause_place <- renderPlotly({
    df <- filtered_cause_scaled() |>
      group_by(cause_short, place) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop")
    
    p <- df |>
      ggplot(aes(x = reorder(cause_short, total_deaths), y = total_deaths, fill = place,
                 text = paste0("<b>", cause_short, "</b><br>Place: ", place,
                               "<br>Deaths: ", scales::comma(round(total_deaths))))) +
      geom_col(position = "stack") + coord_flip() +
      scale_y_continuous(labels = scales::comma) +
      labs(x = NULL, y = "Total Deaths", fill = "Place", title = "Deaths by Cause & Place") +
      theme_minimal(base_size = 10) +
      theme(panel.grid.minor = element_blank(), plot.title = element_text(face = "bold", size = 12))
    ggplotly(p, tooltip = "text") |> layout(margin = list(l = 175, r = 20))
  })
  
  output$plot_yll <- renderPlotly({
    df <- deaths_years_life_lost |>
      filter(year >= input$year_range[1], year <= input$year_range[2],
             cause != "All causes", !is.na(yll_u75))
    if (input$sex_filter != "Both Sexes") df <- df |> filter(sex == input$sex_filter)
    # Apply region scaling to YLL as well
    scale <- region_scale()
    df <- df |>
      group_by(cause) |>
      summarise(total_yll = sum(yll_u75, na.rm = TRUE) * scale, .groups = "drop") |>
      arrange(desc(total_yll)) |> slice_head(n = 10)
    
    p <- df |>
      ggplot(aes(x = reorder(cause, total_yll), y = total_yll, fill = cause,
                 text = paste0("<b>", cause, "</b><br>YLL (Thousands, under 75): ",
                               scales::comma(round(total_yll, 1))))) +
      geom_col(show.legend = FALSE) + coord_flip() +
      scale_y_continuous(labels = scales::comma) +
      scale_fill_brewer(palette = "RdYlBu") +
      labs(x = NULL, y = "Years of Life Lost — Under 75 (Thousands)",
           title = "Top 10 Causes by Years of Life Lost (Under Age 75)",
           subtitle = "Higher YLL = greater premature mortality burden") +
      theme_minimal(base_size = 11) +
      theme(panel.grid.minor = element_blank(),
            axis.text.y = element_blank(), axis.ticks.y = element_blank(),
            plot.title = element_text(face = "bold", size = 12),
            plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text") |> layout(margin = list(l = 10, r = 40))
  })
  
  
  # TAB 6: PREDICTIONS
  
  # Helper: run auto.arima and return tidy forecast tibble
  run_arima_forecast <- function(annual_vec, years_vec, h) {
    ts_data <- ts(annual_vec, start = min(years_vec), frequency = 1)
    fit     <- auto.arima(ts_data, stepwise = FALSE, approximation = FALSE)
    fc      <- forecast(fit, h = h, level = c(80, 95))
    last_year <- max(years_vec)
    tibble(
      year     = seq(last_year + 1, last_year + h),
      mean     = as.numeric(fc$mean),
      lo80     = as.numeric(fc$lower[, 1]),
      hi80     = as.numeric(fc$upper[, 1]),
      lo95     = as.numeric(fc$lower[, 2]),
      hi95     = as.numeric(fc$upper[, 2])
    )
  }
  
  # 6a: Overall mortality forecast
  output$plot_forecast_total <- renderPlotly({
    h <- input$forecast_horizon
    
    # Historical annual totals
    hist_df <- deaths_by_cause_place |>
      filter(sex != "Both Sexes", !is.na(age_band), age_band != "All Ages",
             place != "All places", cause_short != "All Causes") |>
      group_by(year) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
      arrange(year)
    
    fc_df <- run_arima_forecast(hist_df$total_deaths, hist_df$year, h)
    
    # Join last historical point to forecast for continuous line
    bridge <- tibble(year = max(hist_df$year),
                     mean = tail(hist_df$total_deaths, 1),
                     lo80 = tail(hist_df$total_deaths, 1),
                     hi80 = tail(hist_df$total_deaths, 1),
                     lo95 = tail(hist_df$total_deaths, 1),
                     hi95 = tail(hist_df$total_deaths, 1))
    fc_plot <- bind_rows(bridge, fc_df)
    
    p <- ggplot() +
      # 95% CI band
      geom_ribbon(data = fc_plot, aes(x = year, ymin = lo95, ymax = hi95),
                  fill = "#90CAF9", alpha = 0.3) +
      # 80% CI band
      geom_ribbon(data = fc_plot, aes(x = year, ymin = lo80, ymax = hi80),
                  fill = "#1565C0", alpha = 0.25) +
      # Historical line
      geom_line(data = hist_df, aes(x = year, y = total_deaths,
                                    text = paste0("Year: ", year, "<br>Actual Deaths: ", scales::comma(round(total_deaths)))),
                colour = "#1565C0", linewidth = 1.3) +
      geom_point(data = hist_df, aes(x = year, y = total_deaths), colour = "#1565C0", size = 3) +
      # Forecast line
      geom_line(data = fc_plot, aes(x = year, y = mean,
                                    text = paste0("Year: ", year, "<br>Forecast: ", scales::comma(round(mean)),
                                                  "<br>80% CI: [", scales::comma(round(lo80)), " – ", scales::comma(round(hi80)), "]",
                                                  "<br>95% CI: [", scales::comma(round(lo95)), " – ", scales::comma(round(hi95)), "]")),
                colour = "#E53935", linewidth = 1.2, linetype = "dashed") +
      geom_point(data = fc_df, aes(x = year, y = mean), colour = "#E53935", size = 3.5, shape = 17) +
      # Divider
      geom_vline(xintercept = max(hist_df$year) + 0.5, linetype = "dotted", colour = "grey50") +
      annotate("text", x = max(hist_df$year) + 0.55, y = max(hist_df$total_deaths) * 0.97,
               label = "Forecast →", hjust = 0, size = 3.2, colour = "grey50", fontface = "italic") +
      scale_y_continuous(labels = scales::comma) +
      scale_x_continuous(breaks = c(2015:2024, fc_df$year)) +
      labs(x = "Year", y = "Total Deaths",
           title    = paste0("Overall Mortality Forecast (", max(hist_df$year) + 1, "–", max(fc_df$year), ")"),
           subtitle = "Blue = historical  |  Red dashed = forecast  |  Dark/light bands = 80%/95% prediction intervals") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x   = element_text(angle = 45, hjust = 1),
            panel.grid.minor = element_blank(),
            plot.title    = element_text(face = "bold", size = 12),
            plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text")
  })
  
  # 6b: Cause-specific forecast
  output$plot_forecast_cause <- renderPlotly({
    h          <- input$forecast_horizon
    sel_cause  <- input$forecast_cause
    
    hist_df <- deaths_by_cause_place |>
      filter(sex != "Both Sexes", !is.na(age_band), age_band != "All Ages",
             place != "All places", cause_short != "All Causes")
    
    if (sel_cause != "All Causes Combined") {
      hist_df <- hist_df |> filter(cause_short == sel_cause)
    }
    
    hist_df <- hist_df |>
      group_by(year) |>
      summarise(total_deaths = sum(deaths, na.rm = TRUE), .groups = "drop") |>
      arrange(year)
    
    fc_df <- run_arima_forecast(hist_df$total_deaths, hist_df$year, h)
    bridge <- tibble(year = max(hist_df$year), mean = tail(hist_df$total_deaths, 1),
                     lo80 = tail(hist_df$total_deaths, 1), hi80 = tail(hist_df$total_deaths, 1),
                     lo95 = tail(hist_df$total_deaths, 1), hi95 = tail(hist_df$total_deaths, 1))
    fc_plot <- bind_rows(bridge, fc_df)
    
    p <- ggplot() +
      geom_ribbon(data = fc_plot, aes(x = year, ymin = lo95, ymax = hi95), fill = "#CE93D8", alpha = 0.3) +
      geom_ribbon(data = fc_plot, aes(x = year, ymin = lo80, ymax = hi80), fill = "#7B1FA2", alpha = 0.2) +
      geom_line(data  = hist_df, aes(x = year, y = total_deaths,
                                     text = paste0("Year: ", year, "<br>Actual: ", scales::comma(round(total_deaths)))),
                colour = "#7B1FA2", linewidth = 1.2) +
      geom_point(data = hist_df, aes(x = year, y = total_deaths), colour = "#7B1FA2", size = 2.5) +
      geom_line(data  = fc_plot, aes(x = year, y = mean,
                                     text = paste0("Year: ", year, "<br>Forecast: ", scales::comma(round(mean)),
                                                   "<br>95% CI: [", scales::comma(round(lo95)), " – ", scales::comma(round(hi95)), "]")),
                colour = "#E53935", linewidth = 1.1, linetype = "dashed") +
      geom_point(data = fc_df, aes(x = year, y = mean), colour = "#E53935", size = 3, shape = 17) +
      geom_vline(xintercept = max(hist_df$year) + 0.5, linetype = "dotted", colour = "grey50") +
      scale_y_continuous(labels = scales::comma) +
      scale_x_continuous(breaks = c(2015:2024, fc_df$year)) +
      labs(x = "Year", y = "Deaths",
           title    = paste0("Forecast: ", sel_cause),
           subtitle = "Purple = historical  |  Red dashed = forecast  |  Bands = 80%/95% PI") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x = element_text(angle = 45, hjust = 1), panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 12),
            plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text")
  })
  
  # 6c: Excess mortality forecast
  output$plot_forecast_excess <- renderPlotly({
    h <- input$forecast_horizon
    
    # Use monthly Both Sexes / All Ages totals to get expected baseline
    monthly_df <- deaths_by_month |>
      filter(month != "All months", sex == "Both Sexes", age_band == "All Ages") |>
      group_by(year) |>
      summarise(
        total_deaths    = sum(deaths,   na.rm = TRUE),
        expected_deaths = sum(expected, na.rm = TRUE),
        excess_deaths   = sum(excess,   na.rm = TRUE),
        .groups = "drop"
      ) |>
      arrange(year)
    
    fc_actual   <- run_arima_forecast(monthly_df$total_deaths,    monthly_df$year, h)
    fc_expected <- run_arima_forecast(monthly_df$expected_deaths, monthly_df$year, h)
    
    fc_excess <- tibble(
      year          = fc_actual$year,
      excess_mean   = fc_actual$mean   - fc_expected$mean,
      excess_lo95   = fc_actual$lo95   - fc_expected$hi95,
      excess_hi95   = fc_actual$hi95   - fc_expected$lo95
    )
    
    p <- ggplot() +
      geom_ribbon(data = fc_excess, aes(x = year, ymin = excess_lo95, ymax = excess_hi95),
                  fill = "#FFCC80", alpha = 0.5) +
      geom_col(data = monthly_df, aes(x = year, y = excess_deaths,
                                      fill = excess_deaths > 0,
                                      text = paste0("Year: ", year, "<br>Actual Excess: ", scales::comma(round(excess_deaths)))),
               show.legend = FALSE, alpha = 0.8) +
      scale_fill_manual(values = c("TRUE" = "#B71C1C", "FALSE" = "#1565C0")) +
      geom_line(data = fc_excess, aes(x = year, y = excess_mean,
                                      text = paste0("Year: ", year, "<br>Forecast Excess: ", scales::comma(round(excess_mean)),
                                                    "<br>95% CI: [", scales::comma(round(excess_lo95)), " – ",
                                                    scales::comma(round(excess_hi95)), "]")),
                colour = "#E65100", linewidth = 1.2, linetype = "dashed") +
      geom_point(data = fc_excess, aes(x = year, y = excess_mean),
                 colour = "#E65100", size = 3, shape = 17) +
      geom_hline(yintercept = 0, linetype = "dashed", colour = "grey40") +
      geom_vline(xintercept = max(monthly_df$year) + 0.5, linetype = "dotted", colour = "grey50") +
      scale_y_continuous(labels = scales::comma) +
      scale_x_continuous(breaks = c(2015:2024, fc_excess$year)) +
      labs(x = "Year", y = "Excess Deaths",
           title    = "Excess Mortality Forecast",
           subtitle = "Red/blue bars = historical excess  |  Orange = forecast  |  Band = 95% PI") +
      theme_minimal(base_size = 11) +
      theme(axis.text.x = element_text(angle = 45, hjust = 1), panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 12),
            plot.subtitle = element_text(colour = "grey40", size = 10))
    ggplotly(p, tooltip = "text")
  })
  
} # end server

# SECTION 5: RUN

shinyApp(ui, server)