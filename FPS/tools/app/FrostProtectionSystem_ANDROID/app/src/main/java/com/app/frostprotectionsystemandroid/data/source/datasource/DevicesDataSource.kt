package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.*
import io.reactivex.Observable
import io.reactivex.Single


/**
 *
 * @author at-tienhuynh3
 */
interface DevicesDataSource {

    fun getSensorDeviceList(gatewayId: String): Observable<List<DeviceHome>>

    fun getValesDeviceList(): Observable<List<DeviceVavles>>

    fun getNodeData(deviceId: String): Observable<DataNodeRealTime>

    fun reFreshRealTimeSensorData(gatewayId: String, sensorId: String): Single<Boolean>

    fun getValesData(valesId: String): Observable<DataValvesRealTime>

    fun addNewDevice(userId: String, device: Device): Single<Boolean>

    fun getDevice(deviceId: String): Observable<Device>

    fun getDeviceSingle(deviceId: String): Single<Device>

    fun getDeviceValves(deviceId: String): Observable<DeviceVavles>

    fun getDeviceValvesSingle(deviceId: String): Single<DeviceVavles>

    fun updateDevice(device: Device): Single<Boolean>

    fun deleteDevice(device: Device): Single<Boolean>

    fun controlDevice(gatewayId: String, deviceId: String, status: String): Single<Boolean>

    fun getDataLogValves(deviceId: String): Single<List<DeviceDataValves>>

    fun getDataLogSensor(deviceId: String, startDate: Long, endDate: Long): Single<List<DeviceDataNode>>
}
