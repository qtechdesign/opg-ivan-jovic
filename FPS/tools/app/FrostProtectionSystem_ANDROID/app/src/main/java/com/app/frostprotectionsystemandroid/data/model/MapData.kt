package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class MapData(
    @Exclude
    var key: String = "",
    @set:PropertyName("GPS")
    @get:PropertyName("GPS")
    var gps: GPS? = null,
    @set:PropertyName("name")
    @get:PropertyName("name")
    var name: String? = null,
    @set:PropertyName("devices")
    @get:PropertyName("devices")
    var devices: Map<String, DeviceMapData> = mapOf()
) {

    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): MapData? {
        val data = dataSnapshot.getValue(MapData::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<MapData> {
        val data = mutableListOf<MapData>()
        dataSnapshot.children.forEach {
            MapData().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}

data class DeviceMapData(
    @set:PropertyName("GPS")
    @get:PropertyName("GPS")
    var gps: GPS? = null
)
