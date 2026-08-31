package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceDataValves
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.source.datasource.DevicesDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.DevicesRemoteDataSource
import io.reactivex.Observable
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class DevicesRepository : DevicesDataSource {
    private val devicesRemoteDataSource = DevicesRemoteDataSource()

    override fun getValesDeviceList(): Observable<List<DeviceVavles>> {
        return Observable.just(listOf())
    }

    override fun getSensorDeviceList(gatewayId: String) =
        devicesRemoteDataSource.getSensorDeviceList(gatewayId)

    override fun getNodeData(deviceId: String) = devicesRemoteDataSource.getNodeData(deviceId)

    override fun reFreshRealTimeSensorData(gatewayId: String, sensorId: String) =
        devicesRemoteDataSource.reFreshRealTimeSensorData(gatewayId, sensorId)

    override fun getValesData(valesId: String) = devicesRemoteDataSource.getValesData(valesId)

    override fun addNewDevice(userId: String, device: Device) = devicesRemoteDataSource.addNewDevice(userId, device)

    override fun getDevice(deviceId: String) = devicesRemoteDataSource.getDevice(deviceId)

    override fun updateDevice(device: Device): Single<Boolean> = devicesRemoteDataSource.updateDevice(device)

    override fun deleteDevice(device: Device): Single<Boolean> = devicesRemoteDataSource.deleteDevice(device)

    override fun controlDevice(gatewayId: String, deviceId: String, status: String): Single<Boolean> =
        devicesRemoteDataSource.controlDevice(gatewayId, deviceId, status)

    override fun getDeviceValves(deviceId: String): Observable<DeviceVavles> =
        devicesRemoteDataSource.getDeviceValves(deviceId)

    override fun getDataLogValves(deviceId: String): Single<List<DeviceDataValves>> =
        devicesRemoteDataSource.getDataLogValves(deviceId)

    override fun getDataLogSensor(deviceId: String, startDate: Long, endDate: Long) = devicesRemoteDataSource.getDataLogSensor(deviceId, startDate, endDate)

    override fun getDeviceSingle(deviceId: String) = devicesRemoteDataSource.getDeviceSingle(deviceId)

    override fun getDeviceValvesSingle(deviceId: String) = devicesRemoteDataSource.getDeviceValvesSingle(deviceId)
}
