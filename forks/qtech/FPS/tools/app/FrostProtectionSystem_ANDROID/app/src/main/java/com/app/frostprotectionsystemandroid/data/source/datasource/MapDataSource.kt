package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.MapData
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
interface MapDataSource {

    fun getMapDataFromSever(gateWayId: String): Single<MapData>
}