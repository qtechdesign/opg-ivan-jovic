package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class Gateway(
        @Exclude
    var key: String = "",
        @set:PropertyName("GPS")
    @get:PropertyName("GPS")
    var gps: GPS? = null,
        @set:PropertyName("command")
    @get:PropertyName("command")
    var command: String? = null,
        @set:PropertyName("devices")
    @get:PropertyName("devices")
        var devices: Map<String, Device> = mapOf(),
        @set:PropertyName("name")
    @get:PropertyName("name")
    var name: String? = null,
        @set:PropertyName("owner")
    @get:PropertyName("owner")
    var owner: String? = null,
        @set:PropertyName("public_key")
    @get:PropertyName("public_key")
    var publicKey: String? = null
) {

    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): Gateway? {
        val data = dataSnapshot.getValue(Gateway::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<Gateway> {
        val data = mutableListOf<Gateway>()
        dataSnapshot.children.forEach {
            Gateway().fromDataSnapShot(it)?.run {
                data.add(this)
            }
        }
        return data
    }
}
