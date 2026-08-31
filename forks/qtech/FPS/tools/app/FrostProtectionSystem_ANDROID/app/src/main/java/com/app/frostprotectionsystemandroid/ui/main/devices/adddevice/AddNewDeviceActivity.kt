package com.app.frostprotectionsystemandroid.ui.main.devices.adddevice

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.ArrayAdapter
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.*
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.data.source.repository.KeySerialRepository
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.scan.ScanActivity
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.android.gms.location.LocationServices
import com.google.firebase.auth.FirebaseAuth
import kotlinx.android.synthetic.main.content_add_device.*
import org.jetbrains.anko.startActivityForResult


/**
 *
 * @author at-tienhuynh3
 */
class AddNewDeviceActivity : BaseActivity() {

    companion object {
        internal const val QR_CODE_RESULT_DEVICE = 1011
    }

    private lateinit var viewModel: AddNewDeviceVMContract
    private var loadingDialog: LoadingDialog? = null
    private var qRkey = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_add_new_device)

        //init VM
        loadingDialog = LoadingDialog(this, false)
        viewModel =
            AddNewDeviceViewModel(UserRepository(), DevicesRepository(), KeySerialRepository(), GatewayRepository())

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarAddDevice)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //hide keyboard
        touchHideKeyboardAllView(llRootAddDevice)

        setOnClick()

        // progress dialog
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog),
            //Get list gateway
            viewModel.getUser(FirebaseAuth.getInstance().currentUser?.uid ?: "")
                .observeOnUiThread()
                .subscribe({
                    initSpinner()
                }, this::handleError)
        )

    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == QR_CODE_RESULT_DEVICE && resultCode == Activity.RESULT_OK) {
            val resultQR = data?.getStringExtra(ScanActivity.RESULT_QR) ?: ""
            edtQRDevice.setText(resultQR)
            qRkey = resultQR
        }
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        if (grantResults.isNotEmpty()) {
            for (permission in permissions) {
                if (!ActivityCompat.shouldShowRequestPermissionRationale(this, permission)) {
                    if (ActivityCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
                        when (requestCode) {
                            REQUEST_CODE_ASK_PERMISSIONS -> {
                                startActivityForResult<ScanActivity>(
                                    QR_CODE_RESULT_DEVICE,
                                    ScanActivity.TYPE_SCREEN to ScanActivity.TYPE_SCREEN_ADD
                                )
                            }
                            REQUEST_CODE_ASK_PERMISSIONS_LOCATION -> {

                            }
                        }
                    }
                }
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    @SuppressLint("MissingPermission")
    private fun setOnClick() {
        addDeviceScanQR.setOnClickListener {
            if (checkPermissionApp(Manifest.permission.CAMERA, REQUEST_CODE_ASK_PERMISSIONS)) {
                startActivityForResult<ScanActivity>(
                    QR_CODE_RESULT_DEVICE,
                    ScanActivity.TYPE_SCREEN to ScanActivity.TYPE_SCREEN_ADD
                )
            }
        }

        btnFillDevice.setOnClickListener {
            if (checkPermissionApp(Manifest.permission.ACCESS_FINE_LOCATION, REQUEST_CODE_ASK_PERMISSIONS_LOCATION)) {
                LocationServices.getFusedLocationProviderClient(this)
                    .lastLocation.addOnCompleteListener {
                    if (it.isSuccessful) {
                        it.result?.let { location ->
                            edtLatDevice.setText(location.latitude.toString())
                            edtLongDevice.setText(location.longitude.toString())
                        }
                    }
                }
            }
        }

        btnSaveDevice.setOnClickListener {
            if (isOkInput()) {
                addDisposables(
                    viewModel.getGateway(getKeyGateway(spnGatewayId.selectedItemPosition))
                        .observeOnUiThread()
                        .subscribe({ gateway ->
                            viewModel.getSerialId(edtQRDevice.text.toString().trim())
                                .subscribe({ keySerial ->
                                    if (keySerial.serial == null) {
                                        alertDialog(getString(R.string.afterScanErrorSerial)) {
                                            onBackPressed()
                                        }
                                    } else {
                                        val device = getDataFromInput(keySerial = keySerial, gateway = gateway)
                                        //ADD DATA
                                        viewModel.addNewDevice(gateway.owner ?: "", device)
                                                .observeOnUiThread()
                                                .subscribe({
                                                    if (it) {
                                                        finish()
                                                    }
                                                }, this::handleError)
                                    }
                                }, this::handleError)
                        }, {
                            Log.e(AddNewDeviceActivity::class.java.name, it.message)
                        })
                )

                return@setOnClickListener
            }
            alertDialog(getString(R.string.addDeviceActivityTvGatewayEmptyInput)) {}
        }

        btnCancelAddDevice.setOnClickListener {
            onBackPressed()
        }
    }

    private fun initSpinner() {
        val listGateway = getListNameGateway()
        val adapter = ArrayAdapter<String>(this, R.layout.item_spinner_text_view, listGateway)
        spnGatewayId.adapter = adapter
    }

    private fun getListNameGateway(): List<String> {
        val result = mutableListOf<String>()
        viewModel.getUserLocal()?.gateways?.values?.forEach {
            result.add(it.gatewayName ?: "Null")
        }
        return result
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun handleError(throwable: Throwable) {
        alertDialog(throwable.message ?: "") {
            onBackPressed()
        }
    }

    private fun isOkInput(): Boolean {
        return edtNameDevice.text.toString().isNotEmpty() && edtQRDevice.text.toString().isNotEmpty() && edtLatDevice.text.toString().isNotEmpty() && edtLongDevice.text.toString().isNotEmpty() && edtLoraIdDevice.text.isNotEmpty()
    }

    private fun getDataFromInput(keySerial: KeySerial, gateway: Gateway): Device {
        val dataShow = if ((keySerial.serial ?: "").contains(FirebaseConstance.SENSOR_CONST)) {
            DataNode(
                "",
                battery = true,
                hum = true,
                prA = true,
                prW = true,
                soi = true,
                tp1 = true,
                tp2 = true,
                wdr = true,
                wsp = true
            )
        } else {
            null
        }
        return Device(
            (keySerial.serial
                ?: ""),
            GPS(edtLatDevice.text.toString().toDouble(), edtLongDevice.text.toString().toDouble()),
            edtNameDevice.text.toString(),
            dataShow,
            ownerPublicKey = gateway.publicKey,
            owner = gateway.key,
            loraID = edtLoraIdDevice.text.toString(),
            publicKey = keySerial.key
        )
    }

    private fun getKeyGateway(position: Int): String {
        val keys = viewModel.getUserLocal()?.gateways?.keys?.toMutableList() ?: mutableListOf()
        return keys[position]
    }
}
