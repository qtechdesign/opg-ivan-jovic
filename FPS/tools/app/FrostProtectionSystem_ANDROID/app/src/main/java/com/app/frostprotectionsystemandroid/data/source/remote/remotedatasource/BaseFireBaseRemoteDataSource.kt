package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.App
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase

/**
 *
 * @author at-tienhuynh3
 */
object BaseFireBaseRemoteDataSource {

    internal fun fireBaseGetValue(
        url: String,
        onGetValue: (instanceFireBase: DatabaseReference) -> Unit = {},
        onErrorNetwork: (msgError: String) -> Unit = {}
    ) {
        if (App.getInstance().isOnline()) {
            val databaseReference = FirebaseDatabase.getInstance().getReferenceFromUrl(url)
            onGetValue.invoke(databaseReference)
        } else {
            onErrorNetwork.invoke("The operation could not be performed due to a network error")
        }
    }

    internal fun firebaseSetValue(
        url: String,
        onSetValue: (instanceFireBase: DatabaseReference) -> Unit = {},
        onErrorNetwork: (msgError: String) -> Unit = {}
    ) {
        if (App.getInstance().isOnline()) {
            val databaseReference = FirebaseDatabase.getInstance().getReferenceFromUrl(url)
            onSetValue.invoke(databaseReference)
        } else {
            onErrorNetwork.invoke("The operation could not be performed due to a network error")
        }
    }
}
