package com.app.frostprotectionsystemandroid.ui.main.devices.setup

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.widget.Toolbar
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.model.GPS
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.gateways.details.GatewayDetailActivity
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.android.gms.location.LocationServices
import kotlinx.android.synthetic.main.activity_set_up_device.*
import kotlinx.android.synthetic.main.activity_set_up_gateway.llRootSetupGateway

class SetUpDeviceActivity : BaseActivity() {

    companion object {
        internal const val KEY_ID_GATE_WAY = "KEY_ID_GATE_WAY"
        internal const val KEY_ID_DEVICE = "KEY_ID_DEVICE"
        internal const val NAME_DEVICE = "NAME_DEVICE"
    }

    private var gatewayKeyId = ""
    private var deviceId = ""
    private var deviceName = ""
    private lateinit var viewModel: SetUpDeviceVMContract
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_set_up_device)

        //init VM
        loadingDialog = LoadingDialog(this, false)
        viewModel = SetUpDeviceViewModel(DevicesRepository())

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarSetUpDevice)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //Get data
        gatewayKeyId = intent?.getStringExtra(KEY_ID_GATE_WAY) ?: ""
        deviceId = intent?.getStringExtra(KEY_ID_DEVICE) ?: ""
        deviceName = intent?.getStringExtra(NAME_DEVICE) ?: ""

        setData()

        //hideKeyboard
        touchHideKeyboardAllView(llRootSetupGateway)

        //OnClick
        onClick()

        addDisposables(
                viewModel.progressSubject()
                        .observeOnUiThread()
                        .subscribe(this::handleProgressDialog)
        )

        addDisposables(
                if (deviceId.contains(FirebaseConstance.SENSOR_CONST)) {
                    viewModel.getDevice(deviceId)
                            .observeOnUiThread()
                            .subscribe(this::handleGetDeviceSuccess, this::handleError)
                } else {
                    viewModel.getDeviceValves(deviceId)
                            .observeOnUiThread()
                            .subscribe(this::handleGetDeviceValvesSuccess, this::handleError)
                }
        )
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        val inflater = menuInflater
        inflater.inflate(R.menu.delete_gateway, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem?): Boolean {
        if (item?.itemId == R.id.action_delete_gateway) {
            alertDialogConfirm(
                    getString(
                            R.string.addDeviceActivityTvGatewayDeleteDevice, viewModel.getDeviceLocal().name
                    )
            ) {
                viewModel.deleteDevice(getDataFromInput())
                        .observeOnUiThread()
                        .subscribe({
                            finish()
                            val intent = Intent(applicationContext, GatewayDetailActivity::class.java)
                            intent.putExtra(GatewayDetailActivity.KEY_ID_GATE_WAYS, gatewayKeyId)
                            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            startActivity(intent)
                        }, this::handleError)
            }
            return true
        }
        return super.onOptionsItemSelected(item)

    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    private fun setData() {
        supportActionBar?.title = getString(R.string.settingsGatewaysFragmentTvTitle, deviceName)
        tvIdGatewaySetupDevice.text = getString(R.string.settingsGatewaysFragmentTvId, gatewayKeyId)
        tvIdDeviceSetupDevice.text = getString(R.string.settingsGatewaysFragmentDeviceTvId, deviceId)
        edtNameDeviceSetUp.setText(deviceName)
    }

    @SuppressLint("MissingPermission")
    private fun onClick() {
        btnFillDeviceSetUp.setOnClickListener {
            if (checkPermissionApp(Manifest.permission.ACCESS_FINE_LOCATION, REQUEST_CODE_ASK_PERMISSIONS_LOCATION)) {
                LocationServices.getFusedLocationProviderClient(this)
                        .lastLocation.addOnCompleteListener {
                    if (it.isSuccessful) {
                        it.result?.let { location ->
                            edtLatDeviceSetUp.setText(location.latitude.toString())
                            edtLongDeviceSetUp.setText(location.longitude.toString())
                        }
                    }
                }
            }
        }

        btnSaveSetUpDevice.setOnClickListener {
            if (isOkInput()) {
                addDisposables(
                        viewModel.updateDevice(getDataFromInput())
                                .observeOnUiThread()
                                .subscribe({
                                    finish()
                                }, this::handleError)
                )
                return@setOnClickListener
            }
            alertDialog(getString(R.string.addDeviceActivityTvGatewayEmptyInput)) {}
        }

        btnCancelSetUpDevice.setOnClickListener {
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

    private fun handleError(throwable: Throwable) {
        alertDialog(throwable.message ?: ""){
            onBackPressed()
        }
    }

    @SuppressLint("SetTextI18n")
    private fun handleGetDeviceSuccess(device: Device) {
        supportActionBar?.title = getString(R.string.settingsGatewaysFragmentTvTitle, device.name)
        tvIdGatewaySetupDevice.text = getString(R.string.settingsGatewaysFragmentTvId, device.ownerPublicKey)
        tvIdDeviceSetupDevice.text = getString(R.string.settingsGatewaysFragmentDeviceTvId, device.publicKey)
        edtNameDeviceSetUp.setText(device.name)
        edtLoraIdDeviceSetUp.setText(device.loraID?.substring(2))
        edtLatDeviceSetUp.setText(device.gps?.lat.toString())
        edtLongDeviceSetUp.setText(device.gps?.long.toString())
    }

    private fun handleGetDeviceValvesSuccess(device: DeviceVavles) {
        supportActionBar?.title = getString(R.string.settingsGatewaysFragmentTvTitle, device.name)
        tvIdGatewaySetupDevice.text = getString(R.string.settingsGatewaysFragmentTvId, device.ownerPublicKey)
        tvIdDeviceSetupDevice.text = getString(R.string.settingsGatewaysFragmentDeviceTvId, device.publicKey)
        edtNameDeviceSetUp.setText(device.name)
        edtLoraIdDeviceSetUp.setText(device.loraID?.substring(2))
        edtLatDeviceSetUp.setText(device.gps?.lat.toString())
        edtLongDeviceSetUp.setText(device.gps?.long.toString())
    }

    private fun isOkInput(): Boolean {
        return edtNameDeviceSetUp.text.toString().isNotEmpty() && edtLatDeviceSetUp.text.toString().isNotEmpty() && edtLongDeviceSetUp.text.toString().isNotEmpty() && edtLoraIdDeviceSetUp.text.isNotEmpty()
    }

    private fun getDataFromInput(): Device {
        val key = if (deviceId.contains(FirebaseConstance.SENSOR_CONST)) {
            viewModel.getDeviceLocal().key
        } else {
            viewModel.getDeviceValvesLocal().key
        }

        val ownerPublicKey = if (deviceId.contains(FirebaseConstance.SENSOR_CONST)) {
            viewModel.getDeviceLocal().ownerPublicKey
        } else {
            viewModel.getDeviceValvesLocal().ownerPublicKey
        }

        val owner = if (deviceId.contains(FirebaseConstance.SENSOR_CONST)) {
            viewModel.getDeviceLocal().owner
        } else {
            viewModel.getDeviceValvesLocal().owner
        }

        val publicKey = if (deviceId.contains(FirebaseConstance.SENSOR_CONST)) {
            viewModel.getDeviceLocal().publicKey
        } else {
            viewModel.getDeviceValvesLocal().publicKey
        }

        return Device(key, GPS(edtLatDeviceSetUp.text.toString().toDouble(), edtLongDeviceSetUp.text.toString().toDouble()),
                edtNameDeviceSetUp.text.toString(), null, ownerPublicKey = ownerPublicKey, owner = owner, loraID = edtLoraIdDeviceSetUp.text.toString(), publicKey = publicKey)
    }
}
