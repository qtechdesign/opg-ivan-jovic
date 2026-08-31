package com.app.frostprotectionsystemandroid.ui.login.fogotpass

import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface FogotPassVMContract {

    fun sendPasswordResetEmail(email: String): Single<Boolean>

    fun progressSubject(): BehaviorSubject<Boolean>
}