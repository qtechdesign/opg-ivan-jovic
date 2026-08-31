package com.app.frostprotectionsystemandroid.data.source.util

import com.app.frostprotectionsystemandroid.data.source.remote.network.CustomCallback
import retrofit2.Call
import retrofit2.Response
import java.io.IOException

/**
 *
 */
class CallBackApi private constructor() {
    companion object {
        internal fun <T> callback(
            onSuccess: (Call<T>, Response<T>) -> Unit = { _, _ -> },
            onUnAuthenticated: (Throwable) -> Unit = { },
            onClientError: (Throwable) -> Unit = { },
            onServerError: (Throwable) -> Unit = { },
            onNetworkError: (IOException) -> Unit = { },
            onUnExpectedError: (Throwable) -> Unit = { }
        ): CustomCallback<T> = object : CustomCallback<T> {
            override fun success(call: Call<T>, response: Response<T>) {
                onSuccess.invoke(call, response)
            }

            override fun unauthenticated(t: Throwable) {
                onUnAuthenticated.invoke(t)
            }

            override fun clientError(t: Throwable) {
                onClientError.invoke(t)
            }

            override fun serverError(t: Throwable) {
                onServerError.invoke(t)
            }

            override fun networkError(e: IOException) {
                onNetworkError.invoke(e)
            }

            override fun unexpectedError(t: Throwable) {
                onUnExpectedError.invoke(t)
            }
        }
    }
}
