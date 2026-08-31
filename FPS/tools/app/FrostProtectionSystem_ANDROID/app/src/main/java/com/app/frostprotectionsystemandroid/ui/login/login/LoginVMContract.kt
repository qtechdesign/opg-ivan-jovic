package com.app.frostprotectionsystemandroid.ui.login.login

import com.app.frostprotectionsystemandroid.data.model.User
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.firebase.auth.FirebaseUser
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface LoginVMContract {

    fun login(email: String, pass: String): Single<FirebaseUser>

    fun saveUserId(userId: String): Single<Any>

    fun saveEmail(email: String): Single<Any>

    fun saveIsRemember(isSave: Boolean): Single<Any>

    fun getEmail(): Single<String>

    fun getIsRemember(): Boolean

    fun progressSubject(): BehaviorSubject<Boolean>

    fun loginWithGoogleProvider(acct: GoogleSignInAccount): Single<FirebaseUser>

    fun saveUserToFireBase(userId: String, userName: String, email: String): Single<Boolean>

    fun getUser(userId: String): Observable<User>
}
