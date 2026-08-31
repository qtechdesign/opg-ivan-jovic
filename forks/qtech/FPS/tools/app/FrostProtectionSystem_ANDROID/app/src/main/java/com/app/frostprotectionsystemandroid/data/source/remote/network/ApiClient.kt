package com.app.frostprotectionsystemandroid.data.source.remote.network

import com.app.frostprotectionsystemandroid.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Converter
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.lang.reflect.Type

/**
 *
 */
open class ApiClient private constructor(url: String? = null) {

    internal var token: String? = null
    private var baseUrl: String = if (url == null || url.isEmpty()) "http://172.17.29.7:8089/" else url

    companion object : SingletonHolder<ApiClient, String>(::ApiClient)

    val service: ApiService
        get() {
            return createService()
        }

    private fun createService(): ApiService {
        val httpClientBuilder = OkHttpClient.Builder()
        if (BuildConfig.DEBUG) {
            httpClientBuilder.addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY))
        }
        httpClientBuilder.interceptors().add(Interceptor { chain ->
            val original = chain.request()
            // Request customization: add request headers
            val requestBuilder = original.newBuilder()
                .method(original.method(), original.body())
            if (token != null) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }
            val request = requestBuilder.build()
            chain.proceed(request)
        })
        val client = httpClientBuilder.build()
        val nullOnEmptyConverterFactory = object : Converter.Factory() {
            override fun responseBodyConverter(
                type: Type,
                annotations: Array<out Annotation>,
                retrofit: Retrofit
            ): Converter<ResponseBody, Any?>? {
                val delegate = retrofit.nextResponseBodyConverter<Any?>(this, type, annotations)
                return Converter { body -> if (body.contentLength() == 0L) null else delegate.convert(body) }
            }
        }
        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(GsonConverterFactory.create())
            .addConverterFactory(nullOnEmptyConverterFactory)
            .addCallAdapterFactory(CustomCallAdapterFactory.create())
            .client(client)
            .build()
        return retrofit.create(ApiService::class.java)
    }
}

/**
 * Use this class to create singleton object with argument
 */
open class SingletonHolder<out T, in A>(private var creator: (A?) -> T) {
    @kotlin.jvm.Volatile
    private var instance: T? = null

    /**
     * Generate instance for T class with argument A
     */
    fun getInstance(arg: A? = null): T {
        val i = instance
        if (i != null) {
            return i
        }

        return synchronized(this) {
            val i2 = instance
            if (i2 != null) {
                i2
            } else {
                val created = creator(arg)
                instance = created
                created
            }
        }
    }

    /**
     * Clear current instance
     */
    fun clearInstance() {
        instance = null
    }
}
