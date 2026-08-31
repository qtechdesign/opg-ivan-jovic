package com.app.frostprotectionsystemandroid.ui.splash

import android.os.Bundle
import android.os.Handler
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.login.LoginActivity
import com.app.frostprotectionsystemandroid.ui.main.MainActivity
import com.google.firebase.auth.FirebaseAuth
import org.jetbrains.anko.startActivity

class SplashActivity : BaseActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_splash)

        val currentUser = FirebaseAuth.getInstance().currentUser

        Handler().postDelayed({
            if (currentUser != null) {
                startActivity<MainActivity>()
            } else {
                startActivity<LoginActivity>()
            }
            finish()
        }, 1000L)
    }
}
