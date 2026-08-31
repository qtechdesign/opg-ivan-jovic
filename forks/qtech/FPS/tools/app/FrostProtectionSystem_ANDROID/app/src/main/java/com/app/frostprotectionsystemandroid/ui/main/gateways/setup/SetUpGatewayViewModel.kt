package com.app.frostprotectionsystemandroid.ui.main.gateways.setup

import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import io.reactivex.Observable
import io.reactivex.subjects.BehaviorSubject

class SetUpGatewayViewModel(private val gatewayRepository: GatewayRepository) :
        SetUpGatewayVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var gateway: Gateway? = null

    override fun getGateway(gatewayId: String): Observable<Gateway> =
            gatewayRepository.getGateway(gatewayId)
                    .doOnNext {
                        gateway = it
                    }
                    .doOnSubscribe { progressSubject.onNext(true) }
                    .doAfterNext { progressSubject.onNext(false) }
                    .doOnError { progressSubject.onNext(false) }

    override fun update(gateway: Gateway) = gatewayRepository.update(gateway)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }

    override fun progressSubject() = progressSubject

    override fun getGatewayLocal(): Gateway = gateway ?: Gateway()

    override fun deleteGateway(gateway: Gateway) = gatewayRepository.deleteGateway(gateway)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }
}
