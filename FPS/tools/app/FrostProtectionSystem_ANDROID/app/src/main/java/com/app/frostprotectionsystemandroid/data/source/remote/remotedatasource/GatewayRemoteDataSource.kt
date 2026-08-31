package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.BuildConfig
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.datasource.GatewayDataSource
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.COMMAND
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.DEVICES
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.DEVICE_LOG
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.GATEWAYS
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.GATEWAYS_DEVICES
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.GPS
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.NAME
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.OWNER
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.PUBLIC_KEY
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance.USERS_ADD
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import io.reactivex.Observable
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class GatewayRemoteDataSource : GatewayDataSource {

    override fun getGateway(gatewayId: String) = Observable.create<Gateway> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "$GATEWAYS_DEVICES/$gatewayId", { databaseReference ->
            databaseReference
                    .addValueEventListener(object : ValueEventListener {
                        override fun onCancelled(p0: DatabaseError) {
                            if (!emitter.isDisposed) {
                                emitter.onError(Throwable(p0.message))
                            }
                        }

                        override fun onDataChange(dataSnapshot: DataSnapshot) {
                            val data = Gateway().fromDataSnapShot(dataSnapshot)
                            emitter.onNext(data ?: Gateway())
                        }
                    })
        }, {
            emitter.onError(Throwable(it))
        })
    }

    override fun getGatewaySingle(gatewayId: String) = Single.create<Gateway> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "$GATEWAYS_DEVICES/$gatewayId", { databaseReference ->
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

    override fun saveGateway(gateway: Gateway) = Single.create<Boolean> { emitter ->
        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            //USER
            val childUpdates = HashMap<String, Any>()
            childUpdates["$USERS_ADD/${gateway.owner}/$GATEWAYS/${gateway.key}/$NAME"] =
                    gateway.name ?: ""
            //GATEWAY
            childUpdates["$GATEWAYS/${gateway.key}/$PUBLIC_KEY"] = gateway.publicKey ?: ""
            childUpdates["$GATEWAYS/${gateway.key}/$NAME"] = gateway.name ?: ""
            childUpdates["$GATEWAYS/${gateway.key}/$OWNER"] = gateway.owner ?: ""
            childUpdates["$GATEWAYS/${gateway.key}/$GPS"] = gateway.gps ?: ""
            childUpdates["$GATEWAYS/${gateway.key}/$COMMAND"] = gateway.command ?: ""

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

    override fun update(gateway: Gateway) = Single.create<Boolean> { emitter ->
        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            // USER
            val childUpdates = HashMap<String, Any>()
            childUpdates["$USERS_ADD/${gateway.owner}/$GATEWAYS/${gateway.key}/$NAME"] =
                    gateway.name ?: ""
            //GATEWAY
            childUpdates["$GATEWAYS/${gateway.key}/$NAME"] = gateway.name ?: ""
            childUpdates["$GATEWAYS/${gateway.key}/$GPS"] = gateway.gps ?: ""

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

    override fun deleteGateway(gateway: Gateway) = Single.create<Boolean> { emitter ->

        BaseFireBaseRemoteDataSource.firebaseSetValue(
                BuildConfig.BASE_URL, { databaseReference ->
            // USER
            val childUpdates = HashMap<String, Any?>()
            childUpdates["$USERS_ADD/${gateway.owner}/$GATEWAYS/${gateway.key}"] = null

            //GATEWAY
            childUpdates["$GATEWAYS/${gateway.key}"] = null

            //Device and logs
            gateway.devices.forEach {
                childUpdates["$DEVICES/${it.key}"] = null
            }

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
}
