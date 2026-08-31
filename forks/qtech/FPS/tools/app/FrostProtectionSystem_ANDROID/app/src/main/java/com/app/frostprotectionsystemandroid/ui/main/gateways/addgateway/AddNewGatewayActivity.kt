package com.app.frostprotectionsystemandroid.ui.main.gateways.addgateway

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.GPS
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.data.source.repository.KeySerialRepository
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.devices.adddevice.AddNewDeviceActivity
import com.app.frostprotectionsystemandroid.ui.main.scan.ScanActivity
import com.google.android.gms.location.LocationServices
import com.google.firebase.auth.FirebaseAuth
import kotlinx.android.synthetic.main.content_add_gateway.*
import org.jetbrains.anko.startActivityForResult


/**
 *
 * @author at-tienhuynh3
 */
class AddNewGatewayActivity : BaseActivity() {

    companion object {
        internal const val QR_CODE_RESULT = 1010
    }

    private lateinit var viewModel: AddNewGatewayVMContract
    private var loadingDialog: LoadingDialog? = null
    private var qRkey = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_add_new_gateway)

        //initVM
        loadingDialog = LoadingDialog(this, false)
        viewModel = AddNewGatewayViewModel(KeySerialRepository(), GatewayRepository())

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarAddGateWay)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //hide keyboard
        touchHideKeyboardAllView(llRootAddGateway)

        setOnClick()

        //Progress
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == QR_CODE_RESULT && resultCode == Activity.RESULT_OK) {

            data?.getStringExtra(ScanActivity.RESULT_QR)?.let { resultQR ->
                edtQRGateway.setText(resultQR)
                qRkey = resultQR
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
                                startActivityForResult<ScanActivity>(
                                    AddNewDeviceActivity.QR_CODE_RESULT_DEVICE,
                                    ScanActivity.TYPE_SCREEN to ScanActivity.TYPE_SCREEN_ADD
                                )

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


    @SuppressLint("MissingPermission")
    private fun setOnClick() {
        addGatewayScan.setOnClickListener {
            if (checkPermissionApp(Manifest.permission.CAMERA, REQUEST_CODE_ASK_PERMISSIONS)) {
                startActivityForResult<ScanActivity>(
                    QR_CODE_RESULT,
                    ScanActivity.TYPE_SCREEN to ScanActivity.TYPE_SCREEN_ADD
                )
            }
        }
        btnFill.setOnClickListener {
            if (checkPermissionApp(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    REQUEST_CODE_ASK_PERMISSIONS_LOCATION
                )
            ) {
                LocationServices.getFusedLocationProviderClient(this)
                    .lastLocation.addOnCompleteListener {
                    if (it.isSuccessful) {
                        it.result?.let { location ->
                            edtLatGateway.setText(location.latitude.toString())
                            edtLongGateway.setText(location.longitude.toString())
                        }
                    }
                }
            }
        }

        btnSaveAddGate.setOnClickListener {
            handleSaveData()
        }

        btnCancelAddGate.setOnClickListener {
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

    private fun handleSaveData() {
        if (isOkInput()) {
            addDisposables(
                viewModel.getSerialId(edtQRGateway.text.toString().trim())
                    .subscribe({ keySerial ->
                        if (keySerial.serial == null) {
                            alertDialog(getString(R.string.afterScanErrorSerial)) {
                                onBackPressed()
                            }
                            return@subscribe
                        }
                        val gateway = Gateway(
                                keySerial?.serial ?: "",
                                GPS(
                                        edtLatGateway.text.toString().toDouble(),
                                        edtLongGateway.text.toString().toDouble()
                                ),
                                "",
                                mapOf(),
                                edtNameGateway.text.toString(),
                                FirebaseAuth.getInstance().currentUser?.uid,
                                keySerial.key
                        )

                        viewModel.saveGateway(gateway).observeOnUiThread()
                                .subscribe({ isSuccess ->
                                    if (isSuccess) {
                                        setResult(Activity.RESULT_OK)
                                        finish()
                                    }
                                }, {
                                    alertDialog(it.message ?: "") {
                                        onBackPressed()
                                    }
                                })
                    }, {})
            )
            return
        }
        alertDialog(getString(R.string.addDeviceActivityTvGatewayEmptyInput)) {}
    }

    private fun isOkInput(): Boolean {
        return edtNameGateway.text.toString().isNotEmpty() && edtQRGateway.text.toString().isNotEmpty() && edtLatGateway.text.toString().isNotEmpty() && edtLongGateway.text.toString().isNotEmpty()
    }
}
