package com.app.frostprotectionsystemandroid.ui.main.chart

import com.app.frostprotectionsystemandroid.data.model.DeviceDataNode
import com.github.mikephil.charting.charts.LineChart
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface HistoryChartVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun setUpChartData(chart: LineChart)

    fun getDataLogSensor(deviceId: String, startDate: Long, endDate: Long): Single<List<DeviceDataNode>>

    fun getDataLogs(): List<DeviceDataNode>

    fun setData(chart: LineChart, dataLogs: List<DeviceDataNode>, dataType: Int)
}