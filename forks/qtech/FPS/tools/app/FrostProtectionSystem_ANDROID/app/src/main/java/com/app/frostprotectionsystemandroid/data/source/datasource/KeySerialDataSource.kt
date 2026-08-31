package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.KeySerial
import io.reactivex.Single

interface KeySerialDataSource {
    fun getSerialId(publicKey: String): Single<KeySerial>

    fun checkExitsOwner(key: String): Single<Boolean>
}
