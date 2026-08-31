package com.app.frostprotectionsystemandroid.ui.main.map

import com.app.frostprotectionsystemandroid.data.model.MapData
import com.app.frostprotectionsystemandroid.data.source.repository.MapRepository
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class MapViewModel(private val mapRepository: MapRepository) : MapVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()

    override fun getMapData(gatewayId: String) = mapRepository.getMapDataFromSever(gatewayId)
        .doOnSubscribe { progressSubject.onNext(true) }
        .doFinally { progressSubject.onNext(false) }

    override fun progressSubject() = progressSubject

    override fun getSensorNodeNum(gatewayId: String, listMapData: List<MapData>): Int {
        val result = mutableListOf<String>()
        listMapData.find { it.key == gatewayId }?.devices?.forEach {
            if (it.key.contains(FirebaseConstance.SENSOR_CONST)) {
                result.add(it.key)
            }
        }
        return result.size
    }

    override fun getValvesNum(gatewayId: String, listMapData: List<MapData>): Int {
        val result = mutableListOf<String>()
        listMapData.find { it.key == gatewayId }?.devices?.forEach {
            if (it.key.contains(FirebaseConstance.VALVES_CONS)) {
                result.add(it.key)
            }
        }
        return result.size
    }

    override fun getGatewayName(gatewayId: String, listMapData: List<MapData>) =
        listMapData.find { it.key == gatewayId }?.name ?: ""
}
