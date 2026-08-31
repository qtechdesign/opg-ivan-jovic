package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class Device(
        @Exclude
        var key: String = "",
        @set:PropertyName("GPS")
        @get:PropertyName("GPS")
        var gps: GPS? = null,
        @set:PropertyName("name")
        @get:PropertyName("name")
        var name: String? = null,
        @set:PropertyName("data_show")
        @get:PropertyName("data_show")
        var data_show: DataNode? = null,
        @set:PropertyName("lora_id")
        @get:PropertyName("lora_id")
        var loraID: String? = null,
        @set:PropertyName("owner")
        @get:PropertyName("owner")
        var owner: String? = null,
        @set:PropertyName("owner_public_key")
        @get:PropertyName("owner_public_key")
        var ownerPublicKey: String? = null,
        @set:PropertyName("public_key")
        @get:PropertyName("public_key")
        var publicKey: String? = null,
        @set:PropertyName("current_data")
        @get:PropertyName("current_data")
        var currentData: DeviceDataNode? = null
) {
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): Device? {
        val data = dataSnapshot.getValue(Device::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<Device> {
        val data = mutableListOf<Device>()
        dataSnapshot.children.forEach {
            Device().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}
