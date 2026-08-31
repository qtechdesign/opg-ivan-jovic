package com.app.frostprotectionsystemandroid.ui.login

import android.os.Bundle
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.extension.addFragment
import com.app.frostprotectionsystemandroid.extension.replaceFragment
import com.app.frostprotectionsystemandroid.extension.setCustomAnimationRightToLeft
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.login.fogotpass.FogotFragment
import com.app.frostprotectionsystemandroid.ui.login.login.LoginFragment
import com.app.frostprotectionsystemandroid.ui.login.signup.SignUpFragment
import com.app.frostprotectionsystemandroid.ui.main.MainActivity
import org.jetbrains.anko.startActivity

class LoginActivity : BaseActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_login)
        addLoginFragment()
    }

    private fun addLoginFragment() {
        addFragment(
                R.id.containerLogin, LoginFragment.newInstance(), {}, null
        )
    }

    internal fun eventOnOpenSignUpFragment() {
        replaceFragment(R.id.containerLogin, SignUpFragment.newInstance(), {
            it.setCustomAnimationRightToLeft()
        }, isAddBackStack = true)
    }

    internal fun eventOnOpenForgotPasswordFragment() {
        replaceFragment(R.id.containerLogin, FogotFragment.newInstance(), {
            it.setCustomAnimationRightToLeft()
        }, isAddBackStack = true)
    }

    internal fun eventMoveToHomeScreen() {
        startActivity<MainActivity>()
        finish()
    }
}
