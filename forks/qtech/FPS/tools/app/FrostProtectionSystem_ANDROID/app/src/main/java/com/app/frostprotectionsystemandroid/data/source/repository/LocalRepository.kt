package com.app.frostprotectionsystemandroid.data.source.repository

import android.content.Context
import com.app.frostprotectionsystemandroid.data.source.datasource.LocalDataSource

/**
 *
 * @author at-tienhuynh3
 */
class LocalRepository(private val context: Context) : LocalDataSource {

    companion object {
        private const val APPLICATION_ID = "com.app.frostprotectionsystemandroid"
        private const val KEY_EMAIL = "key_email"
        private const val KEY_USER_ID = "key_user_id"
        private const val KEY_SAVE_MAIL = "key_save_mail"
    }

    private val pref by lazy {
        context.getSharedPreferences(APPLICATION_ID, Context.MODE_PRIVATE)
    }

    override fun saveEmail(email: String) {
        pref?.edit()?.putString(KEY_EMAIL, email)?.apply()
    }

    override fun getEmail(): String? = pref?.getString(KEY_EMAIL, null) ?: ""

    override fun saveUserId(userId: String) {
        pref?.edit()?.putString(KEY_USER_ID, userId)?.apply()
    }

    override fun getUserId(): String? = pref?.getString(KEY_USER_ID, null) ?: ""

    override fun saveIsRememberEmail(isSave: Boolean) {
        pref?.edit()?.putBoolean(KEY_SAVE_MAIL, isSave)?.apply()
    }

    override fun getIsRemember(): Boolean = pref?.getBoolean(KEY_SAVE_MAIL, false) ?: false

    override fun logOut() {
        pref.edit().remove(KEY_USER_ID).apply()
    }

    override fun savePermission(isSave: Boolean, key: String) {
        pref.edit().putBoolean(key, true).apply()
    }

    override fun getPermission(key: String): Boolean {
        return pref.getBoolean(key, false)
    }
}
