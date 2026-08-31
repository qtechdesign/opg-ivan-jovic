package com.app.frostprotectionsystemandroid.ui.login.signup

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
class SignUpViewModel(
    private val userRepository: UserRepository,
    private val localRepository: LocalRepository
) :
    SignUpVMContract {


    private var progressSubject = BehaviorSubject.create<Boolean>()

    override fun createUserWithEmailAndPassword(email: String, pass: String): Single<FirebaseUser> {
        return userRepository.createUserWithEmailAndPassword(email, pass)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }
            .doFinally {
                progressSubject.onNext(false)
            }
    }

    override fun progressSubject(): BehaviorSubject<Boolean> = progressSubject

    override fun saveUserId(userId: String): Single<Any> {
        return Single.fromCallable {
            localRepository.saveUserId(userId)
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

    override fun loginWithGoogleProvider(acct: GoogleSignInAccount): Single<FirebaseUser> {
        return userRepository.loginWithGoogleProvider(acct)
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
