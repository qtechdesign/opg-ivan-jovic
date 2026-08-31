package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class GPS(
        @set:PropertyName("lat")
        @get:PropertyName("lat")
        var lat: Double? = null,
        @set:PropertyName("long")
        @get:PropertyName("long")
        var long: Double? = null
)