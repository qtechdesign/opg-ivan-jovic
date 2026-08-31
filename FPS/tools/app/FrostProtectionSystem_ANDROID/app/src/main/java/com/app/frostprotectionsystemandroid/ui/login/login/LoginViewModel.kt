package com.app.frostprotectionsystemandroid.ui.login.login

import com.app.frostprotectionsystemandroid.data.model.User
import com.app.frostprotectionsystemandroid.data.source.repository.LocalRepository
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.firebase.auth.FirebaseUser
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class LoginViewModel(
    private val localRepository: LocalRepository,
    private val userRepository: UserRepository
) :
    LoginVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()

    override fun login(email: String, pass: String) = userRepository.login(email, pass)
        .doOnSubscribe {
            progressSubject.onNext(true)
        }
        .doFinally {
            progressSubject.onNext(false)
        }

    override fun saveUserId(userId: String): Single<Any> {
        return Single.fromCallable {
            localRepository.saveUserId(userId)
        }
    }

    override fun saveEmail(email: String): Single<Any> {
        return Single.fromCallable {
            localRepository.saveEmail(email)
        }
    }

    override fun getEmail() = Single.create<String> {
        val email = localRepository.getEmail()
        if (!email.isNullOrEmpty()) {
            it.onSuccess(email)
        }
    }

    override fun saveIsRemember(isSave: Boolean): Single<Any> {
        return Single.fromCallable {
            localRepository.saveIsRememberEmail(isSave)
        }
    }

    override fun getIsRemember(): Boolean {
        return localRepository.getIsRemember()
    }

    override fun progressSubject(): BehaviorSubject<Boolean> = progressSubject

    override fun loginWithGoogleProvider(acct: GoogleSignInAccount): Single<FirebaseUser> {
        return userRepository.loginWithGoogleProvider(acct)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }
            .doFinally {
                progressSubject.onNext(false)
            }
    }

    override fun saveUserToFireBase(
        userId: String,
        userName: String,
        email: String
    ): Single<Boolean> {
        return userRepository.saveUserToFireBase(userId, userName, email)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }
            .doFinally {
                progressSubject.onNext(false)
            }
    }

    override fun getUser(userId: String): Observable<User> {
        return userRepository.getUser(userId)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }
            .doAfterNext {
                progressSubject.onNext(false)
            }
    }
}
