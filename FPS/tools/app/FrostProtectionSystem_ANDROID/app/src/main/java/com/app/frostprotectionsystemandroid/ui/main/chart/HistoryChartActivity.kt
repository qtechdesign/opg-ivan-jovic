package com.app.frostprotectionsystemandroid.ui.main.chart

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.Toolbar
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.extension.alertDialog
import com.app.frostprotectionsystemandroid.extension.destroy
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.utils.DateUtils
import com.app.frostprotectionsystemandroid.utils.DateUtils.PATTERN_DATE_TIME_H
import com.app.frostprotectionsystemandroid.utils.convertTimeLongToString
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.listener.OnChartValueSelectedListener
import com.kunzisoft.switchdatetime.SwitchDateTimeDialogFragment
import kotlinx.android.synthetic.main.activity_history_chart.*
import java.text.SimpleDateFormat
import java.util.*


class HistoryChartActivity : BaseActivity(), OnChartValueSelectedListener {

    companion object {
        private const val TYPE_START = 0
        private const val TYPE_END = 1
        internal const val ID_SEN = "ID_SEN"
    }

    private var itemSelected = 0
    private lateinit var viewmodel: HistoryChartVMContract
    private var loadingDialog: LoadingDialog? = null
    private var idSensor = ""
    private var calendarStart = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
    }
    private var calendarEnd = Calendar.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_history_chart)

        //  init VM
        viewmodel = HistoryChartViewModel(DevicesRepository())
        loadingDialog = LoadingDialog(this, false)
        idSensor = intent.getStringExtra(ID_SEN)

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarChart)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //Default
        toolbar_title.text = getString(R.string.chartTypeTemp1)
        startDate.text =
            getString(R.string.chartStart, calendarStart.timeInMillis.convertTimeLongToString(PATTERN_DATE_TIME_H))
        endDate.text =
            getString(R.string.chartEnd, calendarEnd.timeInMillis.convertTimeLongToString(PATTERN_DATE_TIME_H))

        viewmodel.setUpChartData(chart1)
        chart1.setOnChartValueSelectedListener(this)

        //Progress
        addDisposables(
            viewmodel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )

        handleGetData()

        //Set Onclick
        setOnClick()
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }


    override fun onNothingSelected() {
        //No-op
    }

    override fun onValueSelected(e: Entry?, h: Highlight?) {
        //No-op
    }

    private fun setOnClick() {
        startDate.setOnClickListener {
            showDatePickerDialog(TYPE_START)
        }
        endDate.setOnClickListener {
            showDatePickerDialog(TYPE_END)
        }

        toolbar_title.setOnClickListener {
            singleChoice()
        }
    }

    private fun showDatePickerDialog(type: Int) {
        // Initialize
        val dateTimeDialogFragment = SwitchDateTimeDialogFragment.newInstance(
            getString(R.string.chartDateDialog),
            getString(R.string.chartDateOK),
            getString(R.string.chartDateCancel)
        )
        dateTimeDialogFragment.startAtCalendarView()
        dateTimeDialogFragment.set24HoursMode(true)
        val dateDefault = if (type == TYPE_START) {
            calendarStart.time
        } else {
            calendarEnd.time
        }
        dateTimeDialogFragment.setDefaultDateTime(dateDefault)
        try {
            dateTimeDialogFragment.simpleDateMonthAndDayFormat =
                SimpleDateFormat(DateUtils.PATTERN_DATE_MONTH, Locale.getDefault())
        } catch (e: SwitchDateTimeDialogFragment.SimpleDateMonthAndDayFormatException) {
            Log.e(HistoryChartActivity::class.java.name, e.message)
        }


        dateTimeDialogFragment.setOnButtonClickListener(object : SwitchDateTimeDialogFragment.OnButtonClickListener {
            override fun onPositiveButtonClick(date: Date?) {
                val dateSet = date?.time?.convertTimeLongToString(PATTERN_DATE_TIME_H)
                if (type == TYPE_START) {
                    calendarStart.time = date
                    startDate.text = getString(R.string.chartStart, dateSet)
                    handleGetData()
                    return
                }
                calendarEnd.time = date
                endDate.text = getString(R.string.chartEnd, dateSet)
                handleGetData()
            }

            override fun onNegativeButtonClick(date: Date?) {
                //No-op
            }

        })

// Show
        dateTimeDialogFragment.show(supportFragmentManager, "dialog_time")
    }

    private fun singleChoice() {
        val singleChoiceItems = TypeChart.values().map { it.typeStr }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.chartTitleDialog))
            .setSingleChoiceItems(singleChoiceItems, itemSelected) { dialogInterface, selectedIndex ->
                itemSelected = selectedIndex
                val value = TypeChart.values().find { it.typeInt == selectedIndex }
                toolbar_title.text = value?.typeStr ?: TypeChart.TEMP1.typeStr
                dialogInterface.dismiss()
                handleGetData()
            }
            .show()
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun handleGetData() {
        chart1.clear()
        if (idSensor.isNotEmpty()) {
            addDisposables(
                viewmodel.getDataLogSensor(
                    idSensor,
                    calendarStart.timeInMillis / 1000,
                    calendarEnd.timeInMillis / 1000
                )
                    .observeOnUiThread()
                    .subscribe({
                        if (it.isNotEmpty()) {
                            viewmodel.setData(chart1, viewmodel.getDataLogs(), itemSelected)
                        }
                    }, {
                        alertDialog(it.message.toString()) {
                            onBackPressed()
                        }
                    })
            )

        }
    }
}
