package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import io.reactivex.Observable
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class GatewayDetailViewModel(private val gatewayRepository: GatewayRepository) : GatewayDetailVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var gateway: Gateway? = null

    override fun getGateway(gatewayId: String): Observable<Gateway> = gatewayRepository
            .getGateway(gatewayId)
            .doOnNext {
                gateway = it
            }
            .doOnSubscribe {
                progressSubject.onNext(true)
            }.doAfterNext {
                progressSubject.onNext(false)
            }
            .doOnError {
                progressSubject.onNext(false)
            }

    override fun progressSubject() = progressSubject

    override fun getSensorNodeNum(): Int {
        val result = mutableListOf<String>()
        gateway?.devices?.forEach {
            if (it.key.contains(FirebaseConstance.SENSOR_CONST)) {
                result.add(it.key)
            }
        }
        return result.size
    }

    override fun getValvesNum(): Int {
        val result = mutableListOf<String>()
        gateway?.devices?.forEach {
            if (it.key.contains(FirebaseConstance.VALVES_CONS)) {
                result.add(it.key)
            }
        }
        return result.size
    }
}
