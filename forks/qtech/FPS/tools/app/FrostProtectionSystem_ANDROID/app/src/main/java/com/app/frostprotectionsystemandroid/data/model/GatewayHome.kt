package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class GatewayHome(
    @Exclude
    var key: String = "",
    @set:PropertyName("name")
    @get:PropertyName("name")
    var gatewayName: String? = null,
    @set:PropertyName("devices")
    @get:PropertyName("devices")
    var devices: Map<String, String> = mapOf()
)
