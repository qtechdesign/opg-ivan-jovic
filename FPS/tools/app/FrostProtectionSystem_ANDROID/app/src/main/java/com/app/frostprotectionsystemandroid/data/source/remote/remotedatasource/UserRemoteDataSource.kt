package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import android.util.Log.d
import com.app.frostprotectionsystemandroid.data.model.User
import com.app.frostprotectionsystemandroid.data.model.UserBody
import com.app.frostprotectionsystemandroid.data.source.datasource.UserDataSource
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import io.reactivex.Observable
import io.reactivex.Single


/**
 *
 * @author at-tienhuynh3
 */
class UserRemoteDataSource : UserDataSource {

    override fun getUser(userId: String) = Observable.create<User> { emitter ->
        BaseFireBaseRemoteDataSource.fireBaseGetValue(
            "${FirebaseConstance.USERS}$userId",
            { databaseReference ->
                databaseReference.addValueEventListener(object : ValueEventListener {
                    override fun onCancelled(p0: DatabaseError) {
                        if (!emitter.isDisposed) {
                            emitter.onError(Throwable(p0.message))
                        }
                    }

                    override fun onDataChange(dataSnapshot: DataSnapshot) {
                        val user = User().fromDataSnapShot(dataSnapshot)
                        emitter.onNext(user ?: User())
                    }
                })
            }, {
                emitter.onError(Throwable(it))
            })
    }

    override fun createUserWithEmailAndPassword(email: String, pass: String) =
        Single.create<FirebaseUser> { emitter ->
            val auth = FirebaseAuth.getInstance()
            auth.createUserWithEmailAndPassword(email, pass)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val user = auth.currentUser
                        user?.let {
                            emitter.onSuccess(it)
                        }
                    } else {
                        if (!emitter.isDisposed) {
                            emitter.onError(Throwable(task.exception?.message))
                        }
                    }
                }
        }

    override fun saveUserToFireBase(userId: String, userName: String, email: String) =
        Single.create<Boolean> { emitter ->
            val user = UserBody(user_name = userName, email = email)
            FirebaseDatabase.getInstance().reference
                .child(FirebaseConstance.USERS_ADD)
                .child(userId)
                .setValue(user)
                .addOnSuccessListener {
                    emitter.onSuccess(true)
                }
                .addOnFailureListener {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(it.message))
                    }
                }
        }

    override fun login(email: String, pass: String) = Single.create<FirebaseUser> { emitter ->
        val auth = FirebaseAuth.getInstance()
        auth.signInWithEmailAndPassword(email, pass)
            .addOnCompleteListener {
                if (it.isSuccessful) {
                    auth.currentUser?.let { user ->
                        emitter.onSuccess(user)
                    }
                } else {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(it.exception?.message))
                    }
                }
            }

    }

    override fun sendPasswordResetEmail(email: String) = Single.create<Boolean> { emitter ->
        FirebaseAuth.getInstance().sendPasswordResetEmail(email)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    emitter.onSuccess(true)
                } else {
                    if (!emitter.isDisposed) {
                        emitter.onError(Throwable(task.exception?.message))
                    }
                }
            }
    }

    override fun loginWithGoogleProvider(acct: GoogleSignInAccount) =
        Single.create<FirebaseUser> { emitter ->
            val credential = GoogleAuthProvider.getCredential(acct.idToken, null)
            FirebaseAuth.getInstance().signInWithCredential(credential)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val user = FirebaseAuth.getInstance().currentUser
                        user?.let {
                            emitter.onSuccess(user)
                        }

                    } else {
                        if (!emitter.isDisposed) {
                            emitter.onError(Throwable(task.exception?.message))
                        }
                    }
                }
        }
}
