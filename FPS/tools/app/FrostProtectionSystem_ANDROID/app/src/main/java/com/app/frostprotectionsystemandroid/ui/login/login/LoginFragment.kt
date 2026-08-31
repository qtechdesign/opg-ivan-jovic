package com.app.frostprotectionsystemandroid.ui.login.login

import android.content.Intent
import android.os.Bundle
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.source.repository.LocalRepository
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import com.app.frostprotectionsystemandroid.extension.alertDialog
import com.app.frostprotectionsystemandroid.extension.destroy
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.extension.touchHideKeyboardAllView
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.login.LoginActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseUser
import kotlinx.android.synthetic.main.fragment_login.*
import kotlinx.android.synthetic.main.fragment_login.view.*
import org.jetbrains.anko.sdk25.coroutines.onTouch


/**
 *
 * @author at-tienhuynh3
 */
class LoginFragment : BaseFragment() {

    companion object {

        internal const val RC_SIGN_IN = 999

        internal fun newInstance() = LoginFragment()
    }

    private var ui: View? = null
    private lateinit var viewModel: LoginVMContract
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        context?.let {
            loadingDialog = LoadingDialog(it,true)
            viewModel = LoginViewModel(LocalRepository(it), UserRepository())
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        ui = inflater.inflate(R.layout.fragment_login, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setOnClick()
        getEmail()
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

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_SIGN_IN) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                // Google Sign In was successful, authenticate with FireBase
                val account = task.getResult(ApiException::class.java)
                account?.let {
                    addDisposables(
                        viewModel.loginWithGoogleProvider(it)
                            .observeOnUiThread()
                            .subscribe({ fire ->
                                handleLoginWithGoogleSuccess(fire, it.displayName ?: "username")
                            }, this::handleError)
                    )
                }
            } catch (e: ApiException) {
                // Google Sign In failed, update UI appropriately
                activity?.alertDialog(activity?.getString(R.string.loginFragmentLoginWithGGFailed) ?: "")
            }
        }
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    private fun setOnClick() {
        ui?.run {

            tvForgotPass.setOnClickListener {
                (activity as? LoginActivity)?.eventOnOpenForgotPasswordFragment()
            }

            tvLoginButton.setOnClickListener {
                eventOnLoginClicked()
            }

            tvCreateNewAcc.setOnClickListener {
                (activity as? LoginActivity)?.eventOnOpenSignUpFragment()
            }

            loginWithGGLogin.setOnClickListener {
                eventOnLoginWithGG()
            }

            llTouchShowPass.onTouch { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    edtPassLogin.transformationMethod = HideReturnsTransformationMethod.getInstance()
                    edtPassLogin.isPressed = true
                } else if (event.action == MotionEvent.ACTION_UP) {
                    edtPassLogin.transformationMethod = PasswordTransformationMethod.getInstance()
                    edtPassLogin.isPressed = false

                }
            }
        }
    }

    private fun eventOnLoginClicked() {
        ui?.run {
            val email = edtUserMailLogin.text.trim().toString()
            val pass = edtPassLogin.text.toString()
            addDisposables(
                viewModel.login(email, pass)
                    .observeOnUiThread()
                    .subscribe({
                        val userId = it.uid
                        viewModel.saveUserId(userId)
                            .observeOnUiThread()
                            .subscribe({
                                if (checkbox.isChecked) {
                                    viewModel.saveEmail(email)
                                        .subscribe()
                                }
                                viewModel.saveIsRemember(checkbox.isChecked).subscribe()
                                (activity as? LoginActivity)?.eventMoveToHomeScreen()
                            }, {})

                    }, this@LoginFragment::handleError)
            )
        }
    }


    private fun handleError(throwable: Throwable) {
        activity?.alertDialog(throwable.message.toString())
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun getEmail() {
        if (viewModel.getIsRemember()) {
            addDisposables(
                viewModel.getEmail()
                    .observeOnUiThread()
                    .subscribe({ email ->
                        if (email.isNotEmpty()) {
                            checkbox.isChecked = true
                            edtUserMailLogin.setText(email)
                        }
                    }, {})
            )
        }
    }

    private fun eventOnLoginWithGG() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()

        activity?.run {
            val mGoogleSignInClient = GoogleSignIn.getClient(this, gso)
            val signInIntent = mGoogleSignInClient.signInIntent
            this@LoginFragment.startActivityForResult(signInIntent, RC_SIGN_IN)
        }

    }

    private fun handleLoginWithGoogleSuccess(firebaseUser: FirebaseUser, username: String) {
        val userId = firebaseUser.uid
        addDisposables(
            viewModel.getUser(userId)
                .observeOnUiThread()
                .subscribe({
                    if (it.username == null) {
                        viewModel.saveUserToFireBase(userId, username, firebaseUser.email ?: "")
                            .observeOnUiThread()
                            .subscribe({ isSuccess ->
                                if (isSuccess) {
                                    viewModel.saveUserId(userId)
                                        .observeOnUiThread()
                                        .subscribe({
                                            (activity as? LoginActivity)?.eventMoveToHomeScreen()
                                        }, {})
                                }
                            }, {})
                    } else {
                        viewModel.saveUserId(userId)
                            .observeOnUiThread()
                            .subscribe({
                                (activity as? LoginActivity)?.eventMoveToHomeScreen()
                            }, {})
                    }
                }, {})

        )
    }
}
