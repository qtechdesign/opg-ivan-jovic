package com.app.frostprotectionsystemandroid.ui.main

import com.app.frostprotectionsystemandroid.data.model.User
import com.app.frostprotectionsystemandroid.data.source.repository.LocalRepository
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import io.reactivex.Observable
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class MainViewModel(
    private val userLocalRepository: UserRepository,
    private val localRepository: LocalRepository
) : MainVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()

    private var user = User()

    override fun getUserFromSever(uid: String): Observable<User> {
        return userLocalRepository.getUser(uid)
            .doOnNext {
                user = it
            }
            .doOnSubscribe {
                progressSubject.onNext(true)
            }.doAfterNext {
                progressSubject.onNext(false)
            }
    }

    override fun getUser() = user

    override fun progressSubject(): BehaviorSubject<Boolean> = progressSubject

    override fun getDevicesCount(): Int {
        val result = mutableListOf<String>()
        for ((_, value) in user.gateways) {
            value.devices.forEach {
                result.add(it.key)
            }
        }
        return result.size
    }

    override fun getGatewayCount(): Int {
        val result = mutableListOf<String>()
        for ((key, _) in user.gateways) {
            result.add(key)
        }
        return result.size
    }

    override fun logOut() = localRepository.logOut()
}
