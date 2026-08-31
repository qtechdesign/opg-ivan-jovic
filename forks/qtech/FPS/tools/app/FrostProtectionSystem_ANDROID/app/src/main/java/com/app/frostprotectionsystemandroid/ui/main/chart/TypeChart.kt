package com.app.frostprotectionsystemandroid.ui.main.chart

/**
 *
 * @author at-tienhuynh3
 */
enum class TypeChart(val typeInt: Int, val typeStr: String) {
    TEMP1(0, "Temp 1"),
    TEMP2(1, "Temp 2"),
    WSP(2, "Wind speed"),
    WFR(3, "Wind Direction"),
    AIR(4, "Air Pressure"),
    WATER(5, "Water Pressure"),
    HUM(6, "Humidity"),
    SOIL(7, "Soil moisture"),
    BAT(8, "Battery"),
}
