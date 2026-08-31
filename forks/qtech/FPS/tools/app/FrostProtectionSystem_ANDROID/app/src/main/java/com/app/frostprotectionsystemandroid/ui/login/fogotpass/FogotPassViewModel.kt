package com.app.frostprotectionsystemandroid.ui.login.fogotpass

import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class FogotPassViewModel(private val userRepository: UserRepository) : FogotPassVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()


    override fun sendPasswordResetEmail(email: String): Single<Boolean> {
        return userRepository.sendPasswordResetEmail(email)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }
            .doFinally {
                progressSubject.onNext(false)
            }
    }

    override fun progressSubject(): BehaviorSubject<Boolean> = progressSubject
}
