package com.app.frostprotectionsystemandroid.ui.base

import androidx.appcompat.app.AppCompatActivity
import io.reactivex.disposables.CompositeDisposable
import io.reactivex.disposables.Disposable


/**
 * Use this class to create base function for all activities in this app
 */
abstract class BaseActivity : AppCompatActivity() {

    companion object {
        internal const val REQUEST_CODE_ASK_PERMISSIONS = 1099
        internal const val REQUEST_CODE_ASK_PERMISSIONS_LOCATION = 1098
    }

    private val subscription: CompositeDisposable = CompositeDisposable()

    protected fun addDisposables(vararg ds: Disposable) {
        ds.forEach { subscription.add(it) }
    }

    override fun onDestroy() {
        subscription.clear()
        super.onDestroy()
    }

    override fun onBackPressed() {
        super.onBackPressed()
        if (!isTaskRoot) {
            overridePendingTransition(0, com.app.frostprotectionsystemandroid.R.anim.slide_out_right)
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressed()
        if (!isTaskRoot) {
            overridePendingTransition(0, com.app.frostprotectionsystemandroid.R.anim.slide_out_right)
        }
        return true
    }
}
