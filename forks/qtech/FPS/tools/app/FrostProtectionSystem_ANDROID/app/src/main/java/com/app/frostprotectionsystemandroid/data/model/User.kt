package com.app.frostprotectionsystemandroid.data.model

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.Exclude
import com.google.firebase.database.PropertyName

/**
 *
 * @author at-tienhuynh3
 */
data class User(
    @Exclude
    var key: String = "",
    @set:PropertyName("user_name")
    @get:PropertyName("user_name")
    var username: String? = null,
    @set:PropertyName("email")
    @get:PropertyName("email")
    var email: String? = null,
    @set:PropertyName("gateways")
    @get:PropertyName("gateways")
    var gateways: Map<String, GatewayHome> = mapOf()
) {

    internal fun fromDataSnapShot(dataSnapshot: DataSnapshot): User? {
        val user = dataSnapshot.getValue(User::class.java)
        user?.key = dataSnapshot.key.toString()
        return user
    }

    internal fun fromDataSnapShotToList(dataSnapshot: DataSnapshot): List<User> {
        val users = mutableListOf<User>()
        dataSnapshot.children.forEach {
            User().fromDataSnapShot(it)?.run {
                users.add(this)
            }
        }
        return users
    }
}
