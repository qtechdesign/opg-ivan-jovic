package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import com.app.frostprotectionsystemandroid.data.model.DeviceHome
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface TypeVavlesDeviceNodeVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getListDeviceVavles(): MutableList<DeviceHome>

    fun getListDeviceVavlesSever(gatewayId: String): Observable<List<DeviceHome>>

    fun searchLocal(textSearch: String)
}
