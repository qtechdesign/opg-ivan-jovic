package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.data.model.MapData
import com.app.frostprotectionsystemandroid.data.source.datasource.MapDataSource
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class MapRemoteDataSource : MapDataSource {

    override fun getMapDataFromSever(gateWayId: String): Single<MapData> = Single.create<MapData> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
                "${FirebaseConstance.GATEWAYS_DEVICES}$gateWayId",
                { databaseReference ->
                    databaseReference
                            .addValueEventListener(object : ValueEventListener {
                                override fun onCancelled(p0: DatabaseError) {
                                    if (!emitter.isDisposed) {
                                        emitter.onError(Throwable(p0.message))
                                    }
                                }

                                override fun onDataChange(dataSnapshot: DataSnapshot) {
                                    val data = MapData().fromDataSnapShot(dataSnapshot)
                                    data?.let {
                                        emitter.onSuccess(it)
                                    }
                                }
                            })
                }, {
                emitter.onError(Throwable(it))
        })
    }
}
