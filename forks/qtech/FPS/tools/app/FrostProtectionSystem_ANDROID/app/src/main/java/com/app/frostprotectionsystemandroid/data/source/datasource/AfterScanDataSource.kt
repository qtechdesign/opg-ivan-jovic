package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.model.Gateway
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
interface AfterScanDataSource {

    fun getDataOfGateway(gatewayId: String): Single<Gateway>

    fun getDevice(deviceId: String): Single<Device>

    fun getDeviceValves(deviceId: String): Single<DeviceVavles>
}