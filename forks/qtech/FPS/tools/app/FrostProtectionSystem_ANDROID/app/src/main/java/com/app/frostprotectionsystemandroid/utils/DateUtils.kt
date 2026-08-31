package com.app.frostprotectionsystemandroid.utils

import android.content.Context
import com.app.frostprotectionsystemandroid.R
import org.joda.time.Period
import org.joda.time.PeriodType
import java.text.SimpleDateFormat
import java.util.*

/**
 *
 * @author at-tienhuynh3
 */
object DateUtils {

    internal const val PATTERN_DATE_TIME = "yyyy/MM/dd HH:mm:ss"
    internal const val PATTERN_DATE_TIME_H = "dd/MM/yyyy HH:mm"
    internal const val PATTERN_DATE_TIME_H_Y = "dd/MM/yy HH:mm"
    internal const val PATTERN_DATE = "dd/MM/yyyy"
    internal const val PATTERN_DATE_MONTH = "dd MMMM"

    internal fun getDiffDate(startDate: Long, context: Context): String {
        val period = Period(startDate * 1000, System.currentTimeMillis(), PeriodType.yearMonthDayTime())
        if (period.years > 0) {
            return context.getString(R.string.nodeDeviceTs, period.years.toString().plus(context.getString(R.string.diffDayYear)))
        }
        if (period.months > 0) {
            return context.getString(R.string.nodeDeviceTs, period.months.toString().plus(context.getString(R.string.diffDayMonth)))
        }
        if (period.days > 0) {
            return context.getString(R.string.nodeDeviceTs, period.days.toString().plus(context.getString(R.string.diffDayDays)))
        }
        if (period.hours > 0) {
            return context.getString(R.string.nodeDeviceTs, period.hours.toString().plus(context.getString(R.string.diffDayHours)))
        }
        if (period.minutes > 0) {
            return context.getString(R.string.nodeDeviceTs, period.minutes.toString().plus(context.getString(R.string.diffDayMinutes)))
        }
        if (period.seconds >= 0) {
            return context.getString(R.string.nodeDeviceTs, period.seconds.toString().plus(context.getString(R.string.diffDaySeconds)))
        }
        return ""
    }
}

internal fun Long.convertTimeLongToString(pattern: String): String {
    try {
        val df = SimpleDateFormat(pattern, Locale.getDefault())
        return df.format(Date(this)).toString()
    } catch (e: Exception) {
        //No-opp
    }
    return ""
}

internal fun Long.toTimeMilis() = this * 1000L