package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.source.datasource.KeySerialDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.KeySerialRemoteDataSource

class KeySerialRepository : KeySerialDataSource {

    private val keySerialRemoteDataSource = KeySerialRemoteDataSource()

    override fun getSerialId(publicKey: String) = keySerialRemoteDataSource.getSerialId(publicKey)

    override fun checkExitsOwner(key: String) = keySerialRemoteDataSource.checkExitsOwner(key)
}