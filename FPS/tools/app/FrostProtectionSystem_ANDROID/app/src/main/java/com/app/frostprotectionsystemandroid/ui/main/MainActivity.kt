package com.app.frostprotectionsystemandroid.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.view.MenuItem
import android.widget.ImageView
import androidx.appcompat.app.ActionBarDrawerToggle
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.User
import com.app.frostprotectionsystemandroid.data.source.repository.LocalRepository
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.appinfo.AppInfoActivity
import com.app.frostprotectionsystemandroid.ui.main.gateways.GatewaysFragment
import com.app.frostprotectionsystemandroid.ui.main.gateways.addgateway.AddNewGatewayActivity
import com.app.frostprotectionsystemandroid.ui.main.map.MapActivity
import com.app.frostprotectionsystemandroid.ui.main.scan.ScanActivity
import com.app.frostprotectionsystemandroid.ui.main.setting.SettingActivity
import com.app.frostprotectionsystemandroid.ui.splash.SplashActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.material.navigation.NavigationView
import com.google.firebase.auth.FirebaseAuth
import kotlinx.android.synthetic.main.activity_main2.*
import kotlinx.android.synthetic.main.app_bar_main2.*
import kotlinx.android.synthetic.main.nav_header_main2.view.*
import org.jetbrains.anko.intentFor
import org.jetbrains.anko.startActivity
import org.jetbrains.anko.startActivityForResult


class MainActivity : BaseActivity(), NavigationView.OnNavigationItemSelectedListener {

    companion object {
        private const val REQUEST_CODE_ADD_GATE_WAY = 2111
    }

    private lateinit var viewModel: MainVMContract
    private var loadingDialog: LoadingDialog? = null

    @SuppressLint("CheckResult")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(
            R.anim.slide_in,
            R.anim.slide_out
        )
        setContentView(R.layout.activity_main2)

        loadingDialog = LoadingDialog(this)
        viewModel = MainViewModel(UserRepository(), LocalRepository(this))

        val toolbar: Toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)

        //Init
        initDrawerLayout()

        //Add main fragment
        addHomeListGateWaysFragment()

        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )

        //Get user
        handleGetUser()

        //Set click
        setOnClick()

        //Hide keyboard
        touchHideKeyboardAllView(drawer_layout)
    }

    override fun onBackPressed() {
        val drawerLayout: DrawerLayout = findViewById(R.id.drawer_layout)
        if (drawerLayout.isDrawerOpen(GravityCompat.START)) {
            drawerLayout.closeDrawer(GravityCompat.START)
        } else {
            super.onBackPressed()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == Activity.RESULT_OK) {
            if (requestCode == REQUEST_CODE_ADD_GATE_WAY) {
                handleGetUser()
            }
        }

    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        if (grantResults.isNotEmpty()) {
            for (permission in permissions) {
                if (!ActivityCompat.shouldShowRequestPermissionRationale(this, permission)) {
                    if (ActivityCompat.checkSelfPermission(
                            this,
                            permission
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        when (requestCode) {
                            REQUEST_CODE_ASK_PERMISSIONS -> {
                                startActivity(intentFor<ScanActivity>(ScanActivity.TYPE_SCREEN to ScanActivity.TYPE_SCREEN_HOME))
                            }
                        }
                    }
                }
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    override fun onNavigationItemSelected(item: MenuItem): Boolean {
        // Handle navigation view item_device_node_log clicks here.
        when (item.itemId) {
            R.id.nav_home -> {

            }
            R.id.nav_scan_qr -> {
                if (checkPermissionApp(Manifest.permission.CAMERA, REQUEST_CODE_ASK_PERMISSIONS)) {
                    startActivity(intentFor<ScanActivity>(ScanActivity.TYPE_SCREEN to ScanActivity.TYPE_SCREEN_HOME))
                }
            }
            R.id.nav_map -> {
                Handler().postDelayed({
                    val listGatewaysId = viewModel.getUser().gateways.keys.toList()
                    startActivity<MapActivity>(
                        MapActivity.TYPE_MAP to MapActivity.TYPE_MAP_ALL,
                        MapActivity.GATEWAY_LIST to listGatewaysId
                    )
                }, 200)
            }
            R.id.nav_setting -> {
                startActivity<SettingActivity>()

            }
            R.id.nav_feedback -> {

            }
            R.id.nav_app_info -> {
                startActivity<AppInfoActivity>()
            }
        }
        val drawerLayout: DrawerLayout = findViewById(R.id.drawer_layout)
        drawerLayout.closeDrawer(GravityCompat.START)
        return true
    }

    private fun setOnClick() {
        fabHomeGateways.setOnClickListener {
            startActivityForResult<AddNewGatewayActivity>(REQUEST_CODE_ADD_GATE_WAY)
        }
        fabHomeGatewaysMap.setOnClickListener {
            val listGatewaysId = viewModel.getUser().gateways.keys.toList()
            startActivity<MapActivity>(
                MapActivity.TYPE_MAP to MapActivity.TYPE_MAP_GATEWAY,
                MapActivity.GATEWAY_LIST to listGatewaysId
            )
        }
    }

    private fun addHomeListGateWaysFragment() {
        addFragment(
            R.id.mainContainer, GatewaysFragment.newInstance(), {}, null
        )
    }

    private fun initDrawerLayout() {
        val drawerLayout: DrawerLayout = findViewById(R.id.drawer_layout)
        val navView: NavigationView = findViewById(R.id.nav_view)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            navView.setPadding(0, getStatusBarHeight(), 0, 0);
        }
        navView.itemIconTintList = null
        val toggle = ActionBarDrawerToggle(
            this,
            drawerLayout,
            toolbar,
            R.string.navigation_drawer_open,
            R.string.navigation_drawer_close
        )
        drawerLayout.addDrawerListener(toggle)
        toggle.syncState()

        navView.setNavigationItemSelectedListener(this)


        initClickHeader(navView)
    }

    private fun initClickHeader(navView: NavigationView) {
        val headerView = navView.getHeaderView(0)
        val imgLogout = headerView.findViewById(R.id.imgLogout) as ImageView
        imgLogout.setOnClickListener {
            this@MainActivity.alertDialogConfirm(getString(R.string.gatewaysFragmentDialogLogout)) {
                FirebaseAuth.getInstance().signOut()
                GoogleSignIn.getClient(
                    this@MainActivity,
                    GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build()
                ).signOut()
                viewModel.logOut()
                startActivity<SplashActivity>()
                finish()
            }
        }
    }

    private fun handleGetUserSuccess(user: User) {
        nav_view?.apply {
            this.getHeaderView(0)?.apply {
                tvEmailHeader.text = user.email
                tvHeaderUser.text = user.username
                tvNumGateways.text = getString(
                    R.string.gatewaysFragmentTvGateWays,
                    viewModel.getGatewayCount()
                )
                tvNumDevices.text = getString(
                    R.string.gatewaysFragmentTvDevices,
                    viewModel.getDevicesCount()
                )
            }
        }
        if (getCurrentFragment(R.id.mainContainer) is GatewaysFragment) {
            (getCurrentFragment(R.id.mainContainer) as? GatewaysFragment)?.loadGatewaysHome(
                viewModel.getUser().gateways
            )
        }
    }

    private fun handleGetUserError(throwable: Throwable) {
        alertDialog(throwable.message ?: "")
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun getStatusBarHeight(): Int {
        var result = 0
        val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
        if (resourceId > 0) {
            result = resources.getDimensionPixelSize(resourceId)
        }
        return result
    }

    private fun handleGetUser() {
        //Get user
        addDisposables(
            viewModel.getUserFromSever(FirebaseAuth.getInstance().currentUser?.uid ?: "")
                .observeOnUiThread()
                .subscribe(this::handleGetUserSuccess, this::handleGetUserError)
        )
    }
}
