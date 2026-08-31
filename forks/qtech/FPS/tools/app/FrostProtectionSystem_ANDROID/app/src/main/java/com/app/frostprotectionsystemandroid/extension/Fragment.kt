package com.app.frostprotectionsystemandroid.extension

import androidx.annotation.IdRes
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentTransaction
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment

/**
 * Use this extension for Fragment, FragmentTransaction
 */

internal fun Fragment.addChildFragment(
    @IdRes containerId: Int, fragment: BaseFragment, backStack: String? = null,
    t: (transaction: FragmentTransaction) -> Unit = {}
) {
    if (childFragmentManager.findFragmentByTag(fragment.javaClass.simpleName) == null) {
        val transaction = childFragmentManager.beginTransaction()
        t.invoke(transaction)
        transaction.add(containerId, fragment, fragment.javaClass.simpleName)
        if (backStack != null) {
            transaction.addToBackStack(backStack)
        }
        transaction.commit()
    }
}

internal fun Fragment.replaceChildFragment(
    @IdRes containerId: Int, fragment: BaseFragment, backStack: String? = null,
    t: (transaction: FragmentTransaction) -> Unit = {}
) {
    val transaction = childFragmentManager.beginTransaction()
    t.invoke(transaction)
    transaction.replace(containerId, fragment, backStack)
    if (backStack != null) {
        transaction.addToBackStack(backStack)
    }
    transaction.commit()
}

internal fun Fragment.getCurrentFragment(@IdRes containerId: Int) = childFragmentManager.findFragmentById(containerId)

internal fun FragmentTransaction.setCustomAnimationRightToLeft() {
    setCustomAnimations(R.anim.slide_in_right, 0, 0, R.anim.slide_out_right)
}

