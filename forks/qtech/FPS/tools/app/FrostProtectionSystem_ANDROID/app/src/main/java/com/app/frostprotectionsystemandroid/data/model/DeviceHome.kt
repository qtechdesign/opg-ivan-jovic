package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class DeviceHome(
    @Exclude
    var key: String = "",
    @set:PropertyName("TS")
    @get:PropertyName("TS")
    var ts: Long? = null,
    @set:PropertyName("lora_ID")
    @get:PropertyName("lora_ID")
    var loraID: String? = null,
    @set:PropertyName("name")
    @get:PropertyName("name")
    var name: String? = null,
    @set:PropertyName("on")
    @get:PropertyName("on")
    var isOn: Boolean = false
) {
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): DeviceHome? {
        val data = dataSnapshot.getValue(DeviceHome::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<DeviceHome> {
        val data = mutableListOf<DeviceHome>()
        dataSnapshot.children.forEach {
            DeviceHome().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}
