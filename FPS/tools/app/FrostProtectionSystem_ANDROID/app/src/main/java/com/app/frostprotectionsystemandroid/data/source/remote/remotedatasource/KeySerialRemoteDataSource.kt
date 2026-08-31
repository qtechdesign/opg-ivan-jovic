package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.data.model.KeySerial
import com.app.frostprotectionsystemandroid.data.source.datasource.KeySerialDataSource
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import io.reactivex.Single

class KeySerialRemoteDataSource : KeySerialDataSource {


    override fun getSerialId(publicKey: String) = Single.create<KeySerial> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
            "${FirebaseConstance.KEY_SERIAL}$publicKey",
            { databaseReference ->
                databaseReference.addValueEventListener(object : ValueEventListener {
                    override fun onCancelled(p0: DatabaseError) {
                        if (!emitter.isDisposed) {
                            emitter.onError(Throwable(p0.message))
                        }
                    }

                    override fun onDataChange(dataSnapshot: DataSnapshot) {
                        val data = KeySerial().fromDataSnapShot(dataSnapshot)
                        emitter.onSuccess(data ?: KeySerial())
                    }
                })
            }, {
                emitter.onError(Throwable(it))
            })

    }

    override fun checkExitsOwner(key: String) = Single.create<Boolean> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
            "${FirebaseConstance.GATEWAYS_DEVICES}$key/owner",
            { databaseReference ->
                databaseReference.addValueEventListener(object : ValueEventListener {
                    override fun onCancelled(p0: DatabaseError) {
                        if (!emitter.isDisposed) {
                            emitter.onSuccess(false)
                        }
                    }

                    override fun onDataChange(dataSnapshot: DataSnapshot) {
                        if (dataSnapshot.value?.toString().isNullOrEmpty()) {
                            emitter.onSuccess(true)
                        }
                    }
                })
            }, {
                emitter.onError(Throwable(it))
            })
    }
}
