package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */

data class DataNodeRealTime(
        @Exclude
        var key: String = "",
        @set:PropertyName("data_show")
        @get:PropertyName("data_show")
        var data_show: DataNode? = null,
        @set:PropertyName("current_data")
        @get:PropertyName("current_data")
        var current_data: DeviceDataNode? = null
) {
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): DataNodeRealTime? {
        val data = dataSnapshot.getValue(DataNodeRealTime::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }
}

data class DeviceDataNode(
        @Exclude
        var key: String = "",
        @set:PropertyName("TS")
        @get:PropertyName("TS")
        var timestamp: Long? = null,
        @set:PropertyName("data")
        @get:PropertyName("data")
        var data: DataNode? = null
) {
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): DeviceDataNode? {
        val data = dataSnapshot.getValue(DeviceDataNode::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<DeviceDataNode> {
        val data = mutableListOf<DeviceDataNode>()
        dataSnapshot.children.forEach {
            DeviceDataNode().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}

data class DataNode(
        @Exclude
        var key: String = "",
        @set:PropertyName("bat")
        @get:PropertyName("bat")
        var battery: Any? = null,
        @set:PropertyName("hum")
        @get:PropertyName("hum")
        var hum: Any? = null,
        @set:PropertyName("prA")
        @get:PropertyName("prA")
        var prA: Any? = null,
        @set:PropertyName("prW")
        @get:PropertyName("prW")
        var prW: Any? = null,
        @set:PropertyName("soi")
        @get:PropertyName("soi")
        var soi: Any? = null,
        @set:PropertyName("tp1")
        @get:PropertyName("tp1")
        var tp1: Any? = null,
        @set:PropertyName("tp2")
        @get:PropertyName("tp2")
        var tp2: Any? = null,
        @set:PropertyName("wdr")
        @get:PropertyName("wdr")
        var wdr: Any? = null,
        @set:PropertyName("wsp")
        @get:PropertyName("wsp")
        var wsp: Any? = null
)
