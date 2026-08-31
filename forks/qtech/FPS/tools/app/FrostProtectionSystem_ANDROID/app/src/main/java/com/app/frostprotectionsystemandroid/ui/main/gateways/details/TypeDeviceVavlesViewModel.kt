package com.app.frostprotectionsystemandroid.ui.main.gateways.details


import com.app.frostprotectionsystemandroid.data.model.DeviceHome
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import io.reactivex.Observable
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class TypeDeviceVavlesViewModel(private val devicesRepository: DevicesRepository) :
        TypeVavlesDeviceNodeVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var vavlesList = mutableListOf<DeviceHome>()
    private var oldNodeList = mutableListOf<DeviceHome>()

    override fun getListDeviceVavlesSever(gatewayId: String): Observable<List<DeviceHome>> =
            devicesRepository.getSensorDeviceList(gatewayId)
                    .doOnSubscribe { progressSubject.onNext(true) }
                    .doOnNext { list ->
                        vavlesList.clear()
                        oldNodeList.clear()
                        vavlesList.addAll(list.filter { deviceHome ->
                            deviceHome.key.contains(
                                    FirebaseConstance.VALVES_CONS
                            )
                        })
                        oldNodeList.addAll(vavlesList)
                    }
                    .doAfterNext { progressSubject.onNext(false) }

    override fun getListDeviceVavles() = vavlesList

    override fun progressSubject() = progressSubject

    override fun searchLocal(textSearch: String) {
        vavlesList.clear()
        if (textSearch.isEmpty()) {
            vavlesList.addAll(oldNodeList)
            return
        }
        Thread.sleep(200)
        oldNodeList.forEach {
            if (it.name?.toLowerCase()?.contains(textSearch.toLowerCase()) == true) {
                vavlesList.add(it)
            }
        }

    }
}
