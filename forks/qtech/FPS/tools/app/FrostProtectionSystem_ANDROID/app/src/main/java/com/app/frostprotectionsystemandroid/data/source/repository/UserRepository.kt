package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.source.datasource.UserDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.UserRemoteDataSource
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.firebase.auth.FirebaseUser
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class UserRepository : UserDataSource {

    private val userRemoteDataSource = UserRemoteDataSource()

    override fun getUser(userId: String) = userRemoteDataSource.getUser(userId)

    override fun createUserWithEmailAndPassword(email: String, pass: String): Single<FirebaseUser> =
        userRemoteDataSource.createUserWithEmailAndPassword(email, pass)

    override fun saveUserToFireBase(userId: String, userName: String, email: String): Single<Boolean> =
            userRemoteDataSource.saveUserToFireBase(userId, userName, email)

    override fun login(email: String, pass: String): Single<FirebaseUser> = userRemoteDataSource.login(email, pass)

    override fun sendPasswordResetEmail(email: String): Single<Boolean> =
        userRemoteDataSource.sendPasswordResetEmail(email)

    override fun loginWithGoogleProvider(acct: GoogleSignInAccount): Single<FirebaseUser> =
        userRemoteDataSource.loginWithGoogleProvider(acct)
}
