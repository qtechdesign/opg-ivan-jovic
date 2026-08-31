package com.app.frostprotectionsystemandroid.ui.login.fogotpass

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import com.app.frostprotectionsystemandroid.extension.alertDialog
import com.app.frostprotectionsystemandroid.extension.destroy
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.extension.touchHideKeyboardAllView
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.login.LoginActivity
import kotlinx.android.synthetic.main.fragment_fogot_pass.view.*

/**
 *
 * @author at-tienhuynh3
 */
class FogotFragment : BaseFragment() {

    companion object {
        internal fun newInstance() = FogotFragment()
    }

    private var ui: View? = null
    private lateinit var viewModel: FogotPassVMContract
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        context?.let {
            loadingDialog = LoadingDialog(it, true)
            viewModel = FogotPassViewModel(UserRepository())
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        ui = inflater.inflate(R.layout.fragment_fogot_pass, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setOnClick()
        ui?.run {
            activity?.touchHideKeyboardAllView(llRoot)
        }
    }

    override fun onBindViewModel() {
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    private fun setOnClick() {
        ui?.run {
            tvLoginNow.setOnClickListener {
                (activity as? LoginActivity)?.onBackPressed()
            }
            tvSendMail.setOnClickListener {
                eventOnResetPassClicked()
            }
        }
    }

    private fun eventOnResetPassClicked() {
        ui?.run {
            val mail = edtUserMail.text.trim().toString()
            addDisposables(
                viewModel.sendPasswordResetEmail(mail)
                    .observeOnUiThread()
                    .subscribe({
                        activity?.alertDialog(activity?.getString(R.string.forgotPassFragmentEmailSent) ?: "") {
                            edtUserMail.text.clear()
                        }
                    }, this@FogotFragment::handleError)
            )
        }
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun handleError(throwable: Throwable) {
        activity?.alertDialog(throwable.message.toString())
    }
}