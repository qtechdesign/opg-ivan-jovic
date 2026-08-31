package com.app.frostprotectionsystemandroid.ui.main.chart

import android.graphics.Color
import android.graphics.DashPathEffect
import androidx.core.content.ContextCompat
import com.app.frostprotectionsystemandroid.data.model.DeviceDataNode
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.utils.DateUtils
import com.app.frostprotectionsystemandroid.utils.convertTimeLongToString
import com.app.frostprotectionsystemandroid.utils.toTimeMilis
import com.github.mikephil.charting.charts.LineChart
import com.github.mikephil.charting.components.Legend
import com.github.mikephil.charting.components.LimitLine
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.components.YAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.formatter.IFillFormatter
import com.github.mikephil.charting.formatter.ValueFormatter
import com.github.mikephil.charting.interfaces.datasets.ILineDataSet
import io.reactivex.subjects.BehaviorSubject
import java.util.*


/**
 *
 * @author at-tienhuynh3
 */
class HistoryChartViewModel(private val devicesRepository: DevicesRepository) : HistoryChartVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var dataLogs = mutableListOf<DeviceDataNode>()

    override fun setUpChartData(chart: LineChart) {
        chart.apply {
            // background color
            setBackgroundColor(Color.WHITE)
            // disable description text
            description.isEnabled = false
            // enable touch gestures
            setTouchEnabled(true)
            // set listeners
            setDrawGridBackground(false)
            // enable scaling and dragging
            isDragEnabled = true
            setScaleEnabled(true)

            // chart.setScaleXEnabled(true);
            // chart.setScaleYEnabled(true);

            // force pinch zoom along both axis
            setPinchZoom(true)
            val xAxis: XAxis = this.xAxis
            // X-Axis Style // //
            xAxis.isEnabled = true
            xAxis.position = XAxis.XAxisPosition.BOTTOM
            xAxis.textSize = 10f
            xAxis.textColor = Color.BLACK
            xAxis.valueFormatter = object : ValueFormatter() {
                override fun getFormattedValue(value: Float): String {
                    return dataLogs[value.toInt()].timestamp?.toTimeMilis()?.convertTimeLongToString(DateUtils.PATTERN_DATE_TIME_H_Y)
                        ?: ""
                }
            }
//            xAxis.setDrawAxisLine(true)
//            xAxis.setDrawGridLines(false);

            // vertical grid lines
            xAxis.enableGridDashedLine(10f, 10f, 0f)


            val yAxis: YAxis = axisLeft
            // // Y-Axis Style // //

            // disable dual axis (only use LEFT axis)
            axisRight.isEnabled = true

            // horizontal grid lines
            yAxis.enableGridDashedLine(10f, 10f, 0f)

            // axis range
//            yAxis.axisMaximum = 200f
//            yAxis.axisMinimum = -50f


            // // Create Limit Lines // //
            val llXAxis = LimitLine(9f, "Index 10")
            llXAxis.lineWidth = 4f
            llXAxis.enableDashedLine(10f, 10f, 0f)
            llXAxis.labelPosition = LimitLine.LimitLabelPosition.RIGHT_BOTTOM
            llXAxis.textSize = 10f
        }
    }

    override fun setData(chart: LineChart, dataLogs: List<DeviceDataNode>, dataType: Int) {

        chart.apply {

            val values = ArrayList<Entry>()

            for (i in dataLogs.indices) {

                when (dataType) {
                    TypeChart.TEMP1.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.tp1.toString().toFloat(), -1))
                    }
                    TypeChart.TEMP2.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.tp2.toString().toFloat(), -1))
                    }
                    TypeChart.WSP.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.wsp.toString().toFloat(), -1))
                    }
                    TypeChart.WFR.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.wdr.toString().toFloat(), -1))
                    }
                    TypeChart.AIR.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.prA.toString().toFloat(), -1))

                    }
                    TypeChart.WATER.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.prW.toString().toFloat(), -1))

                    }
                    TypeChart.HUM.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.hum.toString().toFloat(), -1))
                    }
                    TypeChart.SOIL.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.soi.toString().toFloat(), -1))
                    }
                    TypeChart.BAT.typeInt -> {
                        values.add(Entry(i.toFloat(), dataLogs[i].data?.battery.toString().toFloat(), -1))
                    }
                }
            }

            val set1: LineDataSet

            if (data != null && data.dataSetCount > 0) {
                set1 = data.getDataSetByIndex(0) as LineDataSet
                set1.values = values
                set1.notifyDataSetChanged()
                data.notifyDataChanged()
                notifyDataSetChanged()
            } else {
                // create a dataset and give it a type
                set1 = LineDataSet(values, TypeChart.values()[dataType].typeStr)

                set1.setDrawIcons(false)
                set1.mode = LineDataSet.Mode.CUBIC_BEZIER
                set1.isHighlightEnabled = false

                // draw dashed line
//            set1.enableDashedLine(10f, 5f, 0f)

                // black lines and points
                set1.color =
                    ContextCompat.getColor(this.context, com.app.frostprotectionsystemandroid.R.color.colorAccent)
                set1.setCircleColor(
                    ContextCompat.getColor(
                        this.context,
                        com.app.frostprotectionsystemandroid.R.color.colorAccent
                    )
                )
                set1.circleRadius = 0.5F
//            set1.setDrawCircles(false)

                // line thickness and point size
                set1.lineWidth = 1f
                set1.circleRadius = 3f

                // draw points as solid circles
                set1.setDrawCircleHole(false)

                // customize legend entry
                set1.formLineWidth = 1f
                set1.formLineDashEffect = DashPathEffect(floatArrayOf(10f, 5f), 0f)
                set1.formSize = 15f

                // text size of values
                set1.valueTextSize = 9f

                // draw selection line as dashed
                set1.enableDashedHighlightLine(10f, 5f, 0f)

                // set the filled area
                set1.setDrawFilled(true)
                set1.fillFormatter = IFillFormatter { _, _ -> axisLeft.axisMinimum }
                set1.fillColor = Color.WHITE

//            // set color of filled area
//            if (Utils.getSDKInt() >= 18) {
//                // drawables only supported on api level 18 and above
//                val drawable = ContextCompat.getDrawable(this, R.drawable.fade_red)
//                set1.fillDrawable = drawable
//            } else {
//                set1.fillColor = Color.BLACK
//            }

                val dataSets = ArrayList<ILineDataSet>()
                dataSets.add(set1) // add the data sets

                // create a data object with the data sets
                val data = LineData(dataSets)

                // set data
                this.data = data

                // draw points over time
                animateX(1000)

                // get the legend (only possible after setting data)
                val l = legend

                // draw legend entries as lines
                l.form = Legend.LegendForm.LINE
            }
        }
    }

    override fun getDataLogSensor(deviceId: String, startDate: Long, endDate: Long) =
        devicesRepository.getDataLogSensor(deviceId, startDate, endDate)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }
            .doOnSuccess {
                dataLogs.clear()
                dataLogs.addAll(it)
            }

    override fun getDataLogs(): List<DeviceDataNode> = dataLogs

    override fun progressSubject() = progressSubject
}

