package com.app.frostprotectionsystemandroid.ui.login.signup

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
interface SignUpVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun createUserWithEmailAndPassword(email: String, pass: String): Single<FirebaseUser>

    fun saveUserId(userId: String): Single<Any>

    fun saveUserToFireBase(userId: String, userName: String, email: String): Single<Boolean>

    fun loginWithGoogleProvider(acct: GoogleSignInAccount): Single<FirebaseUser>

    fun getUser(userId: String): Observable<User>
}