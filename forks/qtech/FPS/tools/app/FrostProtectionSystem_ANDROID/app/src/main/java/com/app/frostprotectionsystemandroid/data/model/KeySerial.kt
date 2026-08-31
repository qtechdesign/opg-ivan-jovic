package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

data class KeySerial(
    @Exclude
    var key: String = "",
    @set:PropertyName("date")
    @get:PropertyName("date")
    var date: String? = null,
    @set:PropertyName("serial")
    @get:PropertyName("serial")
    var serial: String? = null,
    @set:PropertyName("version")
    @get:PropertyName("version")
    var version: String? = null
) {
    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): KeySerial? {
        val data = dataSnapshot.getValue(KeySerial::class.java)
        data?.key = dataSnapshot.key.toString()
        return data
    }
}

data class KeySerialWithOwner(
    var keySerial: KeySerial,
    var isHaveOwner: Boolean
)
