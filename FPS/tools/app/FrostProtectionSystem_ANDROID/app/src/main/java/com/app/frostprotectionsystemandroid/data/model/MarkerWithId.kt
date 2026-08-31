package com.app.frostprotectionsystemandroid.data.model

import com.google.android.gms.maps.model.Marker

/**
 *
 * @author at-tienhuynh3
 */
data class MarkerWithId(
    var gatewayId: String,
    var deviceId: String,
    var marker: Marker,
    var isGateway: Boolean
    )
