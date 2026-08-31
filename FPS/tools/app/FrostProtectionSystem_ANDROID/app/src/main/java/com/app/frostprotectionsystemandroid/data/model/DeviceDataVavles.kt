package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class DeviceDataVavles(
        @set:PropertyName("TS")
        @get:PropertyName("TS")
        var timestamp: Long? = null,
        @set:PropertyName("data")
        @get:PropertyName("data")
        var data: String? = null
)
