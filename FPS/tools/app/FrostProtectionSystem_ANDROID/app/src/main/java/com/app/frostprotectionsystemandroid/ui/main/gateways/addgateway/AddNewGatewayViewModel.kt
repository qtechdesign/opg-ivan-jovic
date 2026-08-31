package com.app.frostprotectionsystemandroid.ui.main.gateways.addgateway

import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.data.source.repository.KeySerialRepository
import io.reactivex.subjects.BehaviorSubject

class AddNewGatewayViewModel(
    private val keySerialRepository: KeySerialRepository,
    private val gatewayRepository: GatewayRepository
) :
    AddNewGatewayVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()

    override fun getSerialId(publicKey: String) = keySerialRepository
        .getSerialId(publicKey)
        .doOnSubscribe { progressSubject.onNext(true) }
        .doFinally { progressSubject.onNext(false) }

    override fun checkExitsOwner(key: String) =
        keySerialRepository.checkExitsOwner(key)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }

    override fun progressSubject() = progressSubject

    override fun saveGateway(gateway: Gateway) = gatewayRepository
        .saveGateway(gateway)
        .doOnSubscribe { progressSubject.onNext(true) }
        .doFinally { progressSubject.onNext(false) }
}