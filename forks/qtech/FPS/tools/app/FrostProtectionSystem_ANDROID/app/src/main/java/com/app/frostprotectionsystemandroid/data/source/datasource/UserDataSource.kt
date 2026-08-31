package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.User
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.firebase.auth.FirebaseUser
import io.reactivex.Observable
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
interface UserDataSource {

    fun getUser(userId: String): Observable<User>

    fun createUserWithEmailAndPassword(email: String, pass: String): Single<FirebaseUser>

    fun saveUserToFireBase(userId: String, userName: String, email: String): Single<Boolean>

    fun login(email: String, pass: String): Single<FirebaseUser>

    fun sendPasswordResetEmail(email: String): Single<Boolean>

    fun loginWithGoogleProvider(acct: GoogleSignInAccount): Single<FirebaseUser>
}
