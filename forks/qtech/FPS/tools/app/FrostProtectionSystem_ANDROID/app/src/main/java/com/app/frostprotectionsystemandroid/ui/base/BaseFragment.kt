package com.app.frostprotectionsystemandroid.ui.base

import androidx.fragment.app.Fragment
import io.reactivex.disposables.CompositeDisposable
import io.reactivex.disposables.Disposable

/**
 * Copyright © 2017 Asian Tech Co., Ltd.
 * Use this class to create base function for all fragments in this app
 */
abstract class BaseFragment : Fragment() {
    private val subscription: CompositeDisposable = CompositeDisposable()

    override fun onResume() {
        super.onResume()
        onBindViewModel()
    }

    override fun onDestroyView() {
        subscription.clear()
        super.onDestroyView()
    }

    protected fun addDisposables(vararg ds: Disposable) {
        ds.forEach { subscription.add(it) }
    }

    /**
     * This function is used to define subscription
     */
    abstract fun onBindViewModel()
}
