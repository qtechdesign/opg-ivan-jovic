package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.source.datasource.MapDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.MapRemoteDataSource

/**
 *
 * @author at-tienhuynh3
 */
class MapRepository : MapDataSource {

    private val mapRemoteDataSource = MapRemoteDataSource()

    override fun getMapDataFromSever(gateWayId: String) = mapRemoteDataSource.getMapDataFromSever(gateWayId)
}