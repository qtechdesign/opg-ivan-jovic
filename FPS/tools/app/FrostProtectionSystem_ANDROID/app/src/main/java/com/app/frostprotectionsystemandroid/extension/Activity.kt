package com.app.frostprotectionsystemandroid.extension

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.Toast
import androidx.annotation.IdRes
import androidx.annotation.LayoutRes
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentTransaction
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.source.repository.LocalRepository
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import org.jetbrains.anko.alert

/**
 * Created by TienHuynh3 on 28/05/2018.
 * Copyright © AsianTech inc...
 */

/**
 * Toast
 */
internal fun Activity.toast(message: CharSequence, duration: Int = Toast.LENGTH_SHORT) {
    Toast.makeText(this, message, duration).show()
}

/**
 * Replace Fragment
 */
internal fun FragmentActivity.replaceFragment(
    @IdRes containerId: Int, fragment: Fragment,
    transactionFunc: (transaction: FragmentTransaction) -> Unit = {},
    isAddBackStack: Boolean
) {
    if (supportFragmentManager.findFragmentByTag(fragment.javaClass.simpleName) == null) {
        val transaction = supportFragmentManager.beginTransaction()
        transactionFunc.invoke(transaction)
        transaction.replace(containerId, fragment, fragment.javaClass.simpleName)
        if (isAddBackStack) {
            transaction.addToBackStack(fragment.javaClass.simpleName)
        }
        transaction.commit()
    }
}


/**
 * Add Fragment
 */
internal fun FragmentActivity.addFragment(
    @IdRes frameId: Int, fragment: BaseFragment,
    transitionUnit: (transition: FragmentTransaction) -> Unit = {},
    backStack: String? = null
) {
    if (supportFragmentManager.findFragmentByTag(fragment.javaClass.simpleName) == null) {
        val transaction = supportFragmentManager.beginTransaction()
        transitionUnit.invoke(transaction)
        transaction.add(frameId, fragment, fragment.javaClass.simpleName)
        if (backStack != null) {
            transaction.addToBackStack(backStack)
        }
        transaction.commit()
        supportFragmentManager.executePendingTransactions()
    }
}

/**
 * inflate view layout for view group
 */
internal fun ViewGroup.inflate(@LayoutRes layoutRes: Int, attachToRoot: Boolean = false): View =
    LayoutInflater.from(context).inflate(layoutRes, this, attachToRoot)

/**
 * get current fragment
 */
internal fun FragmentActivity.getCurrentFragment(@IdRes containerId: Int) =
    supportFragmentManager.findFragmentById(containerId)

/**
 * Pop Fragment
 */
internal fun FragmentActivity.popFragment() {
    supportFragmentManager.popBackStackImmediate()
}

/**
 * Hide keyboard
 */
internal fun Activity.touchHideKeyboard(view: View?, onHideKeyboard: () -> Unit = {}) {
    if (view !is EditText) {
        view?.setOnTouchListener { _, _ ->
            window.decorView.clearFocus()
            this.hideKeyboard(view)
            onHideKeyboard.invoke()
            false
        }
    }
}

internal fun Activity.touchHideKeyboardAllView(view: View?, onHideKeyboard: () -> Unit = {}) {
    if (view is ViewGroup) {
        (0 until view.childCount)
            .map { view.getChildAt(it) }
            .forEach { this.touchHideKeyboard(it, onHideKeyboard) }
    }
}

internal fun Context.hideKeyboard(view: View, activity: Activity? = null) {
    val inputMethodManager = getSystemService(Activity.INPUT_METHOD_SERVICE) as? InputMethodManager
    inputMethodManager?.hideSoftInputFromWindow(view.windowToken, 0)
    activity?.currentFocus?.clearFocus()
}

internal fun Activity.overridePendingTransitionCustom() =
    overridePendingTransition(android.R.anim.slide_in_left, android.R.anim.slide_out_right)

internal fun Context.alertDialog(
    msg: String, onClick: () -> Unit = {}
) {
    alert(msg) {
        isCancelable = false
        negativeButton("OK") {
            onClick.invoke()
        }
    }.show()
}

internal fun Context.alertDialogConfirm(
    msg: String, onClick: () -> Unit = {}
) {
    alert(msg) {
        isCancelable = false
        negativeButton("CANCEL") {
            //TODO
        }
        positiveButton("OK") {
            onClick.invoke()
        }
    }.show()
}

internal fun LoadingDialog?.destroy() {
    if (this != null && this.isShowing) {
        this.dismiss()
    }
}

fun Activity.checkPermissionApp(key: String, code: Int): Boolean {
    if (ContextCompat.checkSelfPermission(this, key) != PackageManager.PERMISSION_GRANTED) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ActivityCompat.shouldShowRequestPermissionRationale(this, key)) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(key), code
                )
            } else {
                if (LocalRepository(this).getPermission(key)) {
                    onPermissionDialog()
                } else {
                    LocalRepository(this).savePermission(true, key)
                    ActivityCompat.requestPermissions(
                        this, arrayOf(key), code
                    )
                }
            }
            return false
        }
    }
    return true
}

private fun Context.onPermissionDialog() {
    alert(getString(R.string.permissionDialogMsg)) {
        isCancelable = false
        negativeButton(getString(R.string.permissionDialogMsgDeny)) {
            //TODO
        }
        positiveButton(getString(R.string.permissionDialogMsgSetting)) {
            val intent = Intent()
            intent.action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
            val uri = Uri.fromParts("package", packageName, null)
            intent.data = uri
            startActivity(intent)
        }
    }.show()
}
