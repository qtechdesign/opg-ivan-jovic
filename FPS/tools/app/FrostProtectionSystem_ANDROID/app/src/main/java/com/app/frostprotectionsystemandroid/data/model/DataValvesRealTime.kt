package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

data class DataValvesRealTime(
    @Exclude
    var key: String = "",
    @set:PropertyName("name")
    @get:PropertyName("name")
    var name: String? = null,
    @set:PropertyName("current_data")
    @get:PropertyName("current_data")
    var current_data: DeviceDataValves? = null
) {
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): DataValvesRealTime? {
        val data = dataSnapshot.getValue(DataValvesRealTime::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<DataValvesRealTime> {
        val data = mutableListOf<DataValvesRealTime>()
        dataSnapshot.children.forEach {
            DataValvesRealTime().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}

data class DeviceDataValves(
    @Exclude
    var key: String = "",
    @set:PropertyName("TS")
    @get:PropertyName("TS")
    var timestamp: Long = 0L,
    @set:PropertyName("data")
    @get:PropertyName("data")
    var data: String? = null
){
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): DeviceDataValves? {
        val data = dataSnapshot.getValue(DeviceDataValves::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<DeviceDataValves> {
        val data = mutableListOf<DeviceDataValves>()
        dataSnapshot.children.forEach {
            DeviceDataValves().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}

