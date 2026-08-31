package com.app.frostprotectionsystemandroid.ui.main.gateways.details


import com.app.frostprotectionsystemandroid.data.model.DeviceHome
import com.app.frostprotectionsystemandroid.data.model.GatewayHome
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class TypeDeviceNodeViewModel(private val devicesRepository: DevicesRepository) :
    TypeDeviceNodeVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var nodeList = mutableListOf<DeviceHome>()
    private var oldNodeList = mutableListOf<DeviceHome>()


    override fun getListDeviceNode(gatewayId: String): Observable<List<DeviceHome>> =
        devicesRepository.getSensorDeviceList(gatewayId)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doOnNext { list ->
                nodeList.clear()
                oldNodeList.clear()
                nodeList.addAll(list.filter { deviceHome ->
                    deviceHome.key.contains(
                        FirebaseConstance.SENSOR_CONST
                    )
                })
                oldNodeList.addAll(nodeList)
            }
            .doAfterNext { progressSubject.onNext(false) }

    override fun getListDeviceNode() = nodeList

    override fun progressSubject() = progressSubject

    override fun searchLocal(textSearch: String) {
        nodeList.clear()
        if (textSearch.isEmpty()) {
            nodeList.addAll(oldNodeList)
            return
        }
        Thread.sleep(200)
        oldNodeList.forEach {
            if (it.name?.toLowerCase()?.contains(textSearch.toLowerCase()) == true) {
                nodeList.add(it)
            }
        }

    }
}
