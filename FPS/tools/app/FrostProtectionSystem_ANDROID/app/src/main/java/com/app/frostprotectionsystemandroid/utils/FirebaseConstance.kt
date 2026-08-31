package com.app.frostprotectionsystemandroid.utils

import com.app.frostprotectionsystemandroid.BuildConfig

/**
 *
 * @author at-tienhuynh3
 */
object FirebaseConstance {
    internal const val USERS = "${BuildConfig.BASE_URL}users/"
    internal const val GATEWAYS_DEVICES = "${BuildConfig.BASE_URL}gateways/"
    internal const val DEVICES_CURRENT_DATA = "${BuildConfig.BASE_URL}devices/"
    internal const val DEVICES_VALVES_LOG = "${BuildConfig.BASE_URL}device_logs/"
    internal const val KEY_SERIAL = "${BuildConfig.BASE_URL}key/"
    internal const val USERS_ADD = "users"
    internal const val GATEWAYS = "gateways"
    internal const val CURRENT_DATA = "current_data"
    internal const val SENSOR_CONST = "SEN"
    internal const val VALVES_CONS = "VA"
    internal const val GATE_CONS = "GATE"
    internal const val COMMAND = "command"
    internal const val VALVES_ON = "ON"
    internal const val VALVES_OFF = "OFF"
    internal const val NAME = "name"
    internal const val PUBLIC_KEY = "public_key"
    internal const val OWNER = "owner"
    internal const val OWNER_PUBLIC_KEY = "owner_public_key"
    internal const val DATA_SHOW = "data_show"
    internal const val GPS = "GPS"
    internal const val DEVICE_LOG = "device_logs"
    internal const val DEVICES = "devices"
    internal const val LORA_ID = "lora_id"
    internal fun F5_data(sensorId: String): String = "F5_Data: {'key':'$sensorId'}"
    internal fun UP_DEVICE(deviceId: String, loraId: String): String =
        "UPDevice: {'key':'$deviceId','lora_ID':'0x$loraId'}"

    internal fun REMOVE_DEVICE(deviceId: String): String = "removeDevice: {'key':'$deviceId'}"
    internal fun CONTROL_DEVICE(deviceId: String, status: String): String =
        "controlDevice: {'key':'$deviceId', 'status':'$status'}"
}

