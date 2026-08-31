package com.app.frostprotectionsystemandroid.data.source.remote.network

import com.app.frostprotectionsystemandroid.data.model.ConnectInternetEvent
import com.app.frostprotectionsystemandroid.data.source.util.BaseRxCallAdapterWrapper
import okhttp3.ResponseBody
import retrofit2.*
import java.lang.reflect.Type
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 **/
class RxCallAdapterWrapper<R>(type: Type, retrofit: Retrofit, wrapped: CallAdapter<R, *>?) :
    BaseRxCallAdapterWrapper<R>(type, retrofit, wrapped) {

    override fun convertRetrofitExceptionToCustomException(throwable: Throwable, retrofit: Retrofit): Throwable {
        if (throwable is HttpException) {
            val converter: Converter<ResponseBody, ApiException> =
                retrofit.responseBodyConverter(ApiException::class.java, arrayOfNulls<Annotation>(0))
            val response: Response<*>? = throwable.response()
            response?.errorBody()?.let {
                val apiException = converter.convert(it)
                apiException?.run {
                    if (response.code() == HttpURLConnection.HTTP_UNAVAILABLE) {
                        statusCode = HttpURLConnection.HTTP_UNAVAILABLE
                    }
                    return this
                }
            }
        }

        // Handle case error not connect to internet
        if (throwable is UnknownHostException || throwable is ConnectException) {
            // Set message error of this case in activity extension
            val apiException = ApiException("", mutableListOf())
            apiException.statusCode = ApiException.NETWORK_ERROR_CODE
            RxBus.publish(ConnectInternetEvent())
            return apiException
        }

        // Handle case client timeout
        if (throwable is SocketTimeoutException) {
            val apiException = ApiException("", mutableListOf())
            apiException.statusCode = HttpURLConnection.HTTP_CLIENT_TIMEOUT
            return apiException
        }

        return throwable
    }
}
