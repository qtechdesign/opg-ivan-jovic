package com.app.frostprotectionsystemandroid.data.source.remote.network

import com.google.gson.annotations.SerializedName

/**
 *
 */
data class ApiException(
    @SerializedName("message") val messageError: String,
    @SerializedName("errors") val errors: MutableList<String>
) : Throwable(messageError) {
    companion object {
        internal const val NETWORK_ERROR_CODE = 700
    }

    var statusCode: Int? = null
}

