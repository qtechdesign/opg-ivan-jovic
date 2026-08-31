package com.app.frostprotectionsystemandroid.ui.login.signup

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
import com.app.frostprotectionsystemandroid.ui.login.login.LoginFragment
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseUser
import kotlinx.android.synthetic.main.fragment_sign_up.view.*
import org.jetbrains.anko.sdk25.coroutines.onTouch

/**
 *
 * @author at-tienhuynh3
 */
class SignUpFragment : BaseFragment() {

    companion object {
        internal fun newInstance() = SignUpFragment()
    }

    private var ui: View? = null
    private lateinit var viewModel: SignUpVMContract
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        context?.let {
            loadingDialog = LoadingDialog(it, true)
            viewModel = SignUpViewModel(UserRepository(), LocalRepository(it))
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        ui = inflater.inflate(R.layout.fragment_sign_up, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setOnClick()
        checkBoxListener()
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


    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == LoginFragment.RC_SIGN_IN) {
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

    private fun setOnClick() {
        ui?.run {
            tvLoginNow.setOnClickListener {
                (activity as? LoginActivity)?.onBackPressed()
            }
            tvCreateNow.setOnClickListener {
                if (edtName.text.toString().isNotEmpty()) {
                    eventOnCreateUser()
                } else {
                    activity?.apply {
                        alertDialog(getString(R.string.signUpFragmentEmptyUsername))
                    }
                }
            }
            loginWithGG.setOnClickListener {
                eventOnLoginWithGG()
            }

            llTouchShowPassSignUp.onTouch { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    edtPass.transformationMethod = HideReturnsTransformationMethod.getInstance()
                    edtPass.isPressed = true
                } else if (event.action == MotionEvent.ACTION_UP) {
                    edtPass.transformationMethod = PasswordTransformationMethod.getInstance()
                    edtPass.isPressed = false
                }
            }
        }
    }

    private fun checkBoxListener() {
        ui?.run {
            checkbox.setOnCheckedChangeListener { _, isChecked ->
                if (!isChecked) {
                    tvCreateNow.isEnabled = false
                    tvCreateNow.alpha = 0.5F
                    loginWithGG.isEnabled = false
                    loginWithGG.alpha = 0.5F
                } else {
                    tvCreateNow.isEnabled = true
                    tvCreateNow.alpha = 1F
                    loginWithGG.isEnabled = true
                    loginWithGG.alpha = 1F
                }
            }
        }
    }

    private fun eventOnCreateUser() {
        ui?.run {
            val email = edtUserMail.text.trim().toString()
            val pass = edtPass.text.trim().toString()
            addDisposables(
                viewModel.createUserWithEmailAndPassword(email, pass)
                    .observeOnUiThread()
                    .subscribe(this@SignUpFragment::handleCreateUserSuccess, this@SignUpFragment::handleCreateUserError)
            )
        }
    }

    private fun handleCreateUserSuccess(fireBaseUser: FirebaseUser) {
        val userId = fireBaseUser.uid
        ui?.run {
            val username = edtName.text.toString()
            val email = fireBaseUser.email ?: ""
            addDisposables(
                    viewModel.saveUserToFireBase(userId, username, email)
                    .observeOnUiThread()
                    .subscribe({
                        viewModel.saveUserId(userId)
                            .observeOnUiThread()
                            .subscribe({ handleSaveUserIdSuccess() }, {})
                    }, this@SignUpFragment::handleCreateUserError)

            )
        }
    }

    private fun handleSaveUserIdSuccess() {
        activity?.run {
            alertDialog(getString(R.string.signUpFragmentSignUpSuccess)) {
                (activity as? LoginActivity)?.eventMoveToHomeScreen()
            }
        }

    }

    private fun handleCreateUserError(throwable: Throwable) {
        activity?.alertDialog(throwable.message.toString())
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
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
            this@SignUpFragment.startActivityForResult(signInIntent, LoginFragment.RC_SIGN_IN)
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

    private fun handleError(throwable: Throwable) {
        activity?.alertDialog(throwable.message.toString())
    }

}
