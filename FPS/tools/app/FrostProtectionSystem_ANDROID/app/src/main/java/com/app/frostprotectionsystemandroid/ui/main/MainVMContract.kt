package com.app.frostprotectionsystemandroid.ui.main

import com.app.frostprotectionsystemandroid.data.model.User
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface MainVMContract {

    fun getUserFromSever(uid: String): Observable<User>

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getDevicesCount(): Int

    fun getGatewayCount(): Int

    fun getUser(): User

    fun logOut()
}