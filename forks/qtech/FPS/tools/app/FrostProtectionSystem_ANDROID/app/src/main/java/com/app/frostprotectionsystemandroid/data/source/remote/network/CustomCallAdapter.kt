package com.app.frostprotectionsystemandroid.data.source.remote.network

import com.app.frostprotectionsystemandroid.data.model.BusEvent
import okhttp3.Request
import okhttp3.ResponseBody
import retrofit2.*
import java.io.EOFException
import java.io.IOException
import java.net.HttpURLConnection

/**
 *
 */
interface CustomCallback<T> {
    /** Called for [200] responses.  */
    fun success(call: Call<T>, response: Response<T>)

    /** Called for [401] responses.  */
    fun unauthenticated(t: Throwable)

    /** Called for [400, 500) responses, except 401.  */
    fun clientError(t: Throwable)

    /** Called for [500, 600) response.  */
    fun serverError(t: Throwable)

    /** Called for network errors while making the call.  */
    fun networkError(e: IOException)

    /** Called for unexpected errors while making the call.  */
    fun unexpectedError(t: Throwable)
}

/**
 * CustomCall
 */
interface CustomCall<T> {
    /**
     * Cancel call
     */
    fun cancel()

    /**
     * Enqueue call
     */
    fun enqueue(callback: CustomCallback<T>)

    /**
     * Execute call
     */
    fun execute(): Response<T>

    /**
     * Clone
     */
    fun clone(): CustomCall<T>

    /**
     * Request call
     */
    fun request(): Request

    /**
     * Check Call is canceled
     */
    fun isCanceled(): Boolean

    /**
     * Check Call is executed
     */
    fun isExecuted(): Boolean
}

internal class CustomCallAdapter<T>(private val call: Call<T>, private val retrofit: Retrofit) : CustomCall<T> {
    override fun execute() = call.execute()

    override fun clone() = this

    override fun request() = Request.Builder().build()

    override fun isCanceled() = call.isCanceled

    override fun isExecuted() = call.isExecuted

    override fun cancel() {
        call.cancel()
    }

    override fun enqueue(callback: CustomCallback<T>) {
        call.enqueue(object : Callback<T> {
            override fun onResponse(call: Call<T>, response: Response<T>) {
                val code = response.code()
                try {
                    when (code) {
                        HttpURLConnection.HTTP_OK -> callback.success(call, response)
                        HttpURLConnection.HTTP_UNAUTHORIZED -> RxBus.publish(BusEvent())

                        HttpURLConnection.HTTP_BAD_GATEWAY -> {
                            val converter: Converter<ResponseBody, ApiException> =
                                retrofit.responseBodyConverter(ApiException::class.java, arrayOfNulls<Annotation>(0))
                            val responseAfterConvert = converter.convert(response.errorBody())
                            if (responseAfterConvert != null) {
                                callback.serverError(responseAfterConvert)
                            }
                        }

                        //Todo: Handle another status code
                        else -> callback.unexpectedError(Throwable("Error unknow"))
                    }
                } catch (e: EOFException) {
                    callback.unexpectedError(e)
                }
            }

            override fun onFailure(call: Call<T>, t: Throwable) {
                if (t is IOException) {
                    callback.networkError(t)
                } else {
                    callback.unexpectedError(t)
                }
            }
        })
    }
}
