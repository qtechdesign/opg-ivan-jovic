package com.app.frostprotectionsystemandroid.extension

import java.text.SimpleDateFormat
import java.util.*

fun Date.getTimestamp(): String {
    val format = SimpleDateFormat("YYYY-MM-dd hh:mm:ss", Locale.JAPANESE)
    return format.format(this)
}
