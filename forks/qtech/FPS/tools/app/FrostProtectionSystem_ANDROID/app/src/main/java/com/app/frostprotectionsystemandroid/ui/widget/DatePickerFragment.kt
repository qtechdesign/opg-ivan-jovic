package com.app.frostprotectionsystemandroid.ui.widget

import android.app.DatePickerDialog
import android.app.Dialog
import android.os.Bundle
import android.widget.DatePicker
import androidx.fragment.app.DialogFragment
import java.util.*

/**
 *
 * @author at-tienhuynh3
 */
class DatePickerFragment : DialogFragment(), DatePickerDialog.OnDateSetListener {

    internal var onDateSet: (calendarSet: Calendar) -> Unit = {}

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        // Use the current date as the default date in the picker
        val c = Calendar.getInstance()
        val year = c.get(Calendar.YEAR)
        val month = c.get(Calendar.MONTH)
        val day = c.get(Calendar.DAY_OF_MONTH)

        // Create a new instance of DatePickerDialog and return it
        return DatePickerDialog(context, this, year, month, day)
    }

    override fun onDateSet(view: DatePicker, year: Int, month: Int, day: Int) {
        Calendar.getInstance().apply {
            set(year, month, day)
            onDateSet.invoke(this)
        }
    }
}
