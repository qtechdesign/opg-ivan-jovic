package com.app.frostprotectionsystemandroid.ui.main.map

import com.app.frostprotectionsystemandroid.data.model.MapData
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface MapVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getMapData(gatewayId: String): Single<MapData>

    fun getValvesNum(gatewayId: String, listMapData: List<MapData>): Int

    fun getSensorNodeNum(gatewayId: String, listMapData: List<MapData>): Int

    fun getGatewayName(gatewayId: String, listMapData: List<MapData>): String
}