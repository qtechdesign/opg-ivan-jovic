package com.app.frostprotectionsystemandroid.ui.main.gateways.setup

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.widget.Toolbar
import com.app.frostprotectionsystemandroid.data.model.GPS
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.MainActivity
import com.google.android.gms.location.LocationServices
import kotlinx.android.synthetic.main.activity_set_up_gateway.*


class SetUpGatewayActivity : BaseActivity() {

    companion object {
        internal const val KEY_ID_GATE_WAY = "KEY_ID_GATE_WAY"
        internal const val NAME_GATE_WAY = "NAME_GATE_WAY"
        internal const val NAME_GATE_WAY_OK_RESULT = "NAME_GATE_WAY_OK_RESULT"
    }

    private var gatewayKeyId = ""
    private var gatewayName = ""
    private lateinit var viewModel: SetUpGatewayVMContract
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(
            com.app.frostprotectionsystemandroid.R.anim.slide_in,
            com.app.frostprotectionsystemandroid.R.anim.slide_out
        )
        setContentView(com.app.frostprotectionsystemandroid.R.layout.activity_set_up_gateway)

        //initVM
        loadingDialog = LoadingDialog(this, false)
        viewModel = SetUpGatewayViewModel(GatewayRepository())

        //Init toolbar
        val toolbar: Toolbar = findViewById(com.app.frostprotectionsystemandroid.R.id.toolbarSetUpGateWay)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //Get data
        gatewayKeyId = intent?.getStringExtra(KEY_ID_GATE_WAY) ?: ""
        gatewayName = intent?.getStringExtra(NAME_GATE_WAY) ?: ""

        setData()

        //hideKeyboard
        touchHideKeyboardAllView(llRootSetupGateway)

        //Set OnClick
        onClick()

        //Progress
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )

        // getGateway
        addDisposables(
            viewModel.getGateway(gatewayKeyId)
                .observeOnUiThread()
                .subscribe(this::handleGetGatewaySuccess, this::handleGetGatewayError)
        )
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }


    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        val inflater = menuInflater
        inflater.inflate(com.app.frostprotectionsystemandroid.R.menu.delete_gateway, menu)

        return true
    }

    override fun onOptionsItemSelected(item: MenuItem?): Boolean {
        if (item?.itemId == com.app.frostprotectionsystemandroid.R.id.action_delete_gateway) {
            alertDialogConfirm(
                getString(
                    com.app.frostprotectionsystemandroid.R.string.addDeviceActivityTvGatewayDeleteGateway,
                    viewModel.getGatewayLocal().name
                )
            ) {
                addDisposables(
                    viewModel.deleteGateway(viewModel.getGatewayLocal())
                        .observeOnUiThread()
                        .subscribe({ isSuccess ->
                            if (isSuccess) {
                                finish()
                                val intent = Intent(applicationContext, MainActivity::class.java)
                                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                                startActivity(intent)
                            }
                        }, this::handleError)
                )
            }
            return true
        }
        return super.onOptionsItemSelected(item)

    }

    private fun setData() {
        supportActionBar?.title =
            getString(com.app.frostprotectionsystemandroid.R.string.settingsGatewaysFragmentTvTitle, gatewayName)
        edtNameGatewaySetUp.setText(gatewayName)
    }

    @SuppressLint("MissingPermission")
    private fun onClick() {
        btnFillSetupGate.setOnClickListener {
            if (checkPermissionApp(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    REQUEST_CODE_ASK_PERMISSIONS_LOCATION
                )
            ) {
                LocationServices.getFusedLocationProviderClient(this)
                    .lastLocation.addOnCompleteListener {
                    if (it.isSuccessful) {
                        it.result?.let { location ->
                            edtLatGatewaySetUp.setText(location.latitude.toString())
                            edtLongGatewaySetUp.setText(location.longitude.toString())
                        }
                    }
                }
            }
        }

        btnSaveSetUpGate.setOnClickListener {
            if (isOkInput()) {
                val gateway = Gateway(
                    gps = GPS(
                        edtLatGatewaySetUp.text.toString().toDouble(),
                        edtLongGatewaySetUp.text.toString().toDouble()
                    ),
                    name = edtNameGatewaySetUp.text.toString(),
                    owner = viewModel.getGatewayLocal().owner,
                    key = viewModel.getGatewayLocal().key

                )
                addDisposables(
                    viewModel.update(gateway)
                        .observeOnUiThread()
                        .subscribe({
                            if (it) {
                                val intentReturn = Intent()
                                intentReturn.putExtra(
                                    NAME_GATE_WAY_OK_RESULT, gateway.name
                                )
                                setResult(Activity.RESULT_OK, intentReturn)
                                finish()
                            }
                        }, this::handleError)
                )
            } else {
                alertDialog(getString(com.app.frostprotectionsystemandroid.R.string.addDeviceActivityTvGatewayEmptyInput)) {}
            }
        }

        btnCancelSetUpGate.setOnClickListener {
            onBackPressed()
        }
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun handleGetGatewaySuccess(gateway: Gateway) {
        tvIdGateway.text = getString(
            com.app.frostprotectionsystemandroid.R.string.settingsGatewaysFragmentTvId,
            gateway.publicKey
        )

        edtLatGatewaySetUp.setText(gateway.gps?.lat.toString())
        edtLongGatewaySetUp.setText(gateway.gps?.long.toString())

    }

    private fun handleGetGatewayError(throwable: Throwable) {
        Log.e(SetUpGatewayActivity::class.java.name, throwable.message)
    }

    private fun handleError(throwable: Throwable) {
        alertDialog(throwable.message ?: "") {
            onBackPressed()
        }
    }

    private fun isOkInput(): Boolean {
        return edtNameGatewaySetUp.text.toString().isNotEmpty() && edtLatGatewaySetUp.text.toString().isNotEmpty() && edtLongGatewaySetUp.text.toString().isNotEmpty()
    }

}
