package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.BuildConfig
import com.app.frostprotectionsystemandroid.data.model.*
import com.app.frostprotectionsystemandroid.data.source.datasource.DevicesDataSource
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.COMMAND
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.CONTROL_DEVICE
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.DEVICES
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.GATEWAYS
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.GATEWAYS_DEVICES
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.GPS
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.LORA_ID
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.NAME
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.OWNER
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.OWNER_PUBLIC_KEY
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.PUBLIC_KEY
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.REMOVE_DEVICE
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.UP_DEVICE
import com.google.firebase.auth.FirebaseAuth.getInstance
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import io.reactivex.Observable
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class DevicesRemoteDataSource : DevicesDataSource {

    override fun getSensorDeviceList(gatewayId: String) =
            Observable.create<List<DeviceHome>> { emitter ->
                BaseFireBaseRemoteDataSource.fireBaseGetValue(
                        "$GATEWAYS_DEVICES$gatewayId/devices",
                        { databaseReference ->
                            databaseReference
                                    .addValueEventListener(object : ValueEventListener {
                                        override fun onCancelled(p0: DatabaseError) {
                                            if (!emitter.isDisposed) {
                                                emitter.onError(Throwable(p0.message))
                                            }
                                        }

                                        override fun onDataChange(dataSnapshot: DataSnapshot) {
                                            val data = DeviceHome().fromDataSnapShotToList(dataSnapshot)
                                            emitter.onNext(data)
                                        }
                                    })
                        }, {
                    emitter.onError(Throwable(it))
                })
            }


    override fun getValesDeviceList(): Observable<List<DeviceVavles>> {
        return Observable.just(listOf())
    }

    override fun getNodeData(deviceId: String) = Observable.create<DataNodeRealTime> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.DEVICES_CURRENT_DATA}$deviceId/",
                { databaseReference ->
                    databaseReference
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = DataNodeRealTime().fromDataSnapShot(dataSnapshot)
                                    emitter.onNext(data ?: DataNodeRealTime())
                                }
                            })
                }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun reFreshRealTimeSensorData(gatewayId: String, sensorId: String) =
            Single.create<Boolean> { emitter ->
                BaseFireBaseRemoteDataSource.firebaseSetValue("$GATEWAYS_DEVICES/$gatewayId/$COMMAND",
                        { instanceFireBase ->
                            instanceFireBase.setValue(FirebaseConstance.F5_data(sensorId))
                                    .addOnCompleteListener { task ->
                                        if (task.isSuccessful) {
                                            emitter.onSuccess(true)
                                        } else {
                                            if (!emitter.isDisposed) {
                                                emitter.onError(Throwable(task.exception?.message))
                                            }
                                        }
                                    }
                        },
                        {
                            emitter.onError(Throwable(it))
                        })
            }

    override fun getValesData(valesId: String) = Observable.create<DataValvesRealTime> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.DEVICES_CURRENT_DATA}$valesId/",
                { databaseReference ->
                    databaseReference
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = DataValvesRealTime().fromDataSnapShot(dataSnapshot)
                                    emitter.onNext(data ?: DataValvesRealTime())
                                }
                            })
                }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun addNewDevice(userId: String, device: Device) = Single.create<Boolean> { emitter ->

        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            val childUpdates = HashMap<String, Any?>()

            // USER
            childUpdates["${FirebaseConstance.USERS_ADD}/$userId/$GATEWAYS/${device.owner}/$DEVICES/${device.key}"] = ""

            //GATEWAY
            childUpdates["$GATEWAYS/${device.owner}/$DEVICES/${device.key}/$NAME"] = device.name
            childUpdates["$GATEWAYS/${device.owner}/$DEVICES/${device.key}/$GPS"] = device.gps

            //DEVICES
            childUpdates["$DEVICES/${device.key}/$NAME"] = device.name
            childUpdates["$DEVICES/${device.key}/$GPS"] = device.gps
            childUpdates["$DEVICES/${device.key}/$LORA_ID"] = "0x${device.loraID}"
            childUpdates["$DEVICES/${device.key}/$OWNER"] = device.owner
            childUpdates["$DEVICES/${device.key}/$OWNER_PUBLIC_KEY"] = device.ownerPublicKey
            childUpdates["$DEVICES/${device.key}/$PUBLIC_KEY"] = device.publicKey

//            //DATA_SHOW_DEFAULT
//            if (device.key.contains(SENSOR_CONST)) {
//                childUpdates["$DEVICES/${device.key}/$DATA_SHOW"] = device.data_show
//
//            }

            databaseReference.updateChildren(childUpdates).addOnCompleteListener { task ->
                if (task.isSuccessful) {

//                    //Set Command
                    BaseFireBaseRemoteDataSource.firebaseSetValue(
                            BuildConfig.BASE_URL, { databaseReference ->
                        val childUpdatesCommand = HashMap<String, Any?>()

                        childUpdatesCommand["$GATEWAYS/${device.owner}/$COMMAND"] = UP_DEVICE(device.key, device.loraID
                                ?: "12AB")

                        databaseReference.updateChildren(childUpdatesCommand).addOnCompleteListener { task ->
                            if (task.isSuccessful) {
                                emitter.onSuccess(true)
                            } else {
                                if (!emitter.isDisposed) {
                                    emitter.onError(Throwable(task.exception?.message))
                                }
                            }
                        }
                    }, {
                        emitter.onError(Throwable(it))
                    })
                } else {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(task.exception?.message))
                    }
                }
            }
        }, {
            emitter.onError(Throwable(it))
        })

    }

    override fun getDevice(deviceId: String) = Observable.create<Device> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.DEVICES_CURRENT_DATA}$deviceId/",
                { databaseReference ->
                    databaseReference
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = Device().fromDataSnapShot(dataSnapshot)
                                    emitter.onNext(data ?: Device())
                                }
                            })
                }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun getDeviceValves(deviceId: String) = Observable.create<DeviceVavles> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.DEVICES_CURRENT_DATA}$deviceId/",
                { databaseReference ->
                    databaseReference
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = DeviceVavles().fromDataSnapShot(dataSnapshot)
                                    emitter.onNext(data ?: DeviceVavles())
                                }
                            })
                }, {
            emitter.onError(Throwable(it))
        })
    }


    override fun updateDevice(device: Device) = Single.create<Boolean> { emitter ->

        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            val childUpdates = HashMap<String, Any?>()

            //GATEWAY
            childUpdates["$GATEWAYS/${device.owner}/$DEVICES/${device.key}/$NAME"] = device.name
            childUpdates["$GATEWAYS/${device.owner}/$DEVICES/${device.key}/$GPS"] = device.gps
            childUpdates["$GATEWAYS/${device.owner}/$COMMAND"] = UP_DEVICE(device.key, device.loraID
                    ?: "12AB")

            //DEVICES
            childUpdates["$DEVICES/${device.key}/$NAME"] = device.name
            childUpdates["$DEVICES/${device.key}/$GPS"] = device.gps
            childUpdates["$DEVICES/${device.key}/$LORA_ID"] = "0x${device.loraID}"

            databaseReference.updateChildren(childUpdates).addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    emitter.onSuccess(true)
                } else {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(task.exception?.message))
                    }
                }
            }
        }, {
            emitter.onError(Throwable(it))
        })

    }

    override fun deleteDevice(device: Device) = Single.create<Boolean> { emitter ->
        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            // USER
            val childUpdates = HashMap<String, Any?>()
            childUpdates["${FirebaseConstance.USERS_ADD}/${getInstance().currentUser?.uid}/$GATEWAYS/${device.owner}/$DEVICES/${device.key}"] = null

            //GATEWAY
            childUpdates["$GATEWAYS/${device.owner}/$DEVICES/${device.key}"] = null
            childUpdates["$GATEWAYS/${device.owner}/$COMMAND"] = REMOVE_DEVICE(device.key)

            //Device and logs
            childUpdates["$DEVICES/${device.key}"] = null

            databaseReference.updateChildren(childUpdates).addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    emitter.onSuccess(true)
                } else {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(task.exception?.message))
                    }
                }
            }
        }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun controlDevice(gatewayId: String, deviceId: String, status: String) = Single.create<Boolean> { emitter ->
        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            val childUpdates = HashMap<String, Any?>()

            //GATEWAY
            childUpdates["$GATEWAYS/$gatewayId/$COMMAND"] = CONTROL_DEVICE(deviceId, status)

            databaseReference.updateChildren(childUpdates).addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    emitter.onSuccess(true)
                } else {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(task.exception?.message))
                    }
                }
            }
        }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun getDataLogValves(deviceId: String) = Single.create<List<DeviceDataValves>> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.DEVICES_VALVES_LOG}$deviceId/",
                { databaseReference ->
                    databaseReference.orderByChild("TS").limitToLast(10)
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = DeviceDataValves().fromDataSnapShotToList(dataSnapshot)
                                    emitter.onSuccess(data)
                                }
                            })
                }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun getDataLogSensor(deviceId: String, startDate: Long, endDate: Long) = Single.create<List<DeviceDataNode>> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.DEVICES_VALVES_LOG}$deviceId/",
                { databaseReference ->
                    databaseReference.orderByChild("TS").startAt(startDate.toDouble(), "TS").endAt(endDate.toDouble(), "TS")
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = DeviceDataNode().fromDataSnapShotToList(dataSnapshot)
                                    emitter.onSuccess(data)
                                }
                            })
                }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun getDeviceSingle(deviceId: String) = Single.create<Device> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
            "${FirebaseConstance.DEVICES_CURRENT_DATA}$deviceId/",
            { databaseReference ->
                databaseReference
                    .addValueEventListener(object : ValueEventListener {
                        override fun onCancelled(p0: DatabaseError) {
                            if (!emitter.isDisposed) {
                                emitter.onError(Throwable(p0.message))
                            }
                        }

                        override fun onDataChange(dataSnapshot: DataSnapshot) {
                            val data = Device().fromDataSnapShot(dataSnapshot)
                            emitter.onSuccess(data ?: Device())
                        }
                    })
            }, {
                emitter.onError(Throwable(it))
            })
    }

    override fun getDeviceValvesSingle(deviceId: String) = Single.create<DeviceVavles> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
            "${FirebaseConstance.DEVICES_CURRENT_DATA}$deviceId/",
            { databaseReference ->
                databaseReference
                    .addValueEventListener(object : ValueEventListener {
                        override fun onCancelled(p0: DatabaseError) {
                            if (!emitter.isDisposed) {
                                emitter.onError(Throwable(p0.message))
                            }
                        }

                        override fun onDataChange(dataSnapshot: DataSnapshot) {
                            val data = DeviceVavles().fromDataSnapShot(dataSnapshot)
                            emitter.onSuccess(data ?: DeviceVavles())
                        }
                    })
            }, {
                emitter.onError(Throwable(it))
            })
    }
}

