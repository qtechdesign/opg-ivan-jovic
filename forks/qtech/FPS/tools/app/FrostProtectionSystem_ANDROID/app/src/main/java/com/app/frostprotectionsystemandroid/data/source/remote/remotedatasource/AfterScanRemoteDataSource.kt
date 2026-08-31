package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.datasource.AfterScanDataSource
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class AfterScanRemoteDataSource : AfterScanDataSource {

    override fun getDataOfGateway(gatewayId: String) = Single.create<Gateway> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.GATEWAYS_DEVICES}/$gatewayId", { databaseReference ->
            databaseReference
                    .addValueEventListener(object : ValueEventListener {
                        override fun onCancelled(p0: DatabaseError) {
                            if (!emitter.isDisposed) {
                                emitter.onError(Throwable(p0.message))
                            }
                        }

                        override fun onDataChange(dataSnapshot: DataSnapshot) {
                            val data = Gateway().fromDataSnapShot(dataSnapshot)
                            emitter.onSuccess(data ?: Gateway())
                        }
                    })
        }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun getDevice(deviceId: String) = Single.create<Device> { emitter ->
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

    override fun getDeviceValves(deviceId: String)= Single.create<DeviceVavles> { emitter ->
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
