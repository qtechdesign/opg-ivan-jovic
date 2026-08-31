package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.datasource.AfterScanDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.AfterScanRemoteDataSource
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class AfterScanRepository : AfterScanDataSource {

    private val afterScanRemoteDataSource = AfterScanRemoteDataSource()

    override fun getDataOfGateway(gatewayId: String): Single<Gateway> = afterScanRemoteDataSource.getDataOfGateway(gatewayId)

    override fun getDevice(deviceId: String): Single<Device> = afterScanRemoteDataSource.getDevice(deviceId)

    override fun getDeviceValves(deviceId: String): Single<DeviceVavles> = afterScanRemoteDataSource.getDeviceValves(deviceId)
}