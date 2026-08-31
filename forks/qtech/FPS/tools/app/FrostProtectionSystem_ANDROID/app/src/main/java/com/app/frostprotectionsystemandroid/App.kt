package com.app.frostprotectionsystemandroid

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkInfo

class App : Application() {

    companion object {
        private var instance: App? = null
        internal fun getInstance(): App {
            return if (instance == null) {
                App()
            } else {
                instance as App
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        //  instance = this;
        instance = this
    }

    internal fun isOnline(): Boolean {
        val cm = instance?.applicationContext?.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork: NetworkInfo? = cm.activeNetworkInfo
        return activeNetwork?.isConnected == true
    }
}
