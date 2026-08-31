package com.app.frostprotectionsystemandroid.data.source.datasource

/**
 *
 * @author at-tienhuynh3
 */
interface LocalDataSource {

    fun saveEmail(email: String)

    fun getEmail(): String?

    fun saveUserId(userId: String)

    fun getUserId(): String?

    fun saveIsRememberEmail(isSave: Boolean)

    fun getIsRemember(): Boolean

    fun logOut()

    fun savePermission(isSave: Boolean, key: String)

    fun getPermission(key: String): Boolean
}
