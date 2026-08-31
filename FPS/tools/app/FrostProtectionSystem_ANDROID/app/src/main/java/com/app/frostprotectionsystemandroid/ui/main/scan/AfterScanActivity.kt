package com.app.frostprotectionsystemandroid.ui.main.scan

import android.os.Bundle
import android.view.View
import androidx.annotation.IdRes
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentTransaction
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.KeySerial
import com.app.frostprotectionsystemandroid.data.source.repository.AfterScanRepository
import com.app.frostprotectionsystemandroid.data.source.repository.KeySerialRepository
import com.app.frostprotectionsystemandroid.extension.alertDialog
import com.app.frostprotectionsystemandroid.extension.destroy
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.gateways.details.GatewayDetailActivity
import com.app.frostprotectionsystemandroid.ui.main.logs.DeviceLogActivity
import com.app.frostprotectionsystemandroid.utils.DateUtils
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions
import kotlinx.android.synthetic.main.activity_after_scan.*
import kotlinx.android.synthetic.main.item_gate_way.*
import kotlinx.android.synthetic.main.item_node_device.*
import kotlinx.android.synthetic.main.item_vavles_device.*
import org.jetbrains.anko.intentFor
import org.jetbrains.anko.startActivity
import org.jetbrains.anko.textColor

class AfterScanActivity : BaseActivity(), OnMapReadyCallback {

    companion object {
        internal const val TYPE_QR = "TYPE_QR"
    }

    private var ggMap: GoogleMap? = null
    private var typeQR = ""
    private lateinit var viewModel: AfterScanVMContract
    private var loadingDialog: LoadingDialog? = null
    private var keySerial: KeySerial? = null
    private var gateId = ""
    private var deviceId = ""
    private var isMapReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_after_scan)

        //initVM
        loadingDialog = LoadingDialog(this, false)
        viewModel = AfterScanViewModel(KeySerialRepository(), AfterScanRepository())

        typeQR = intent?.getStringExtra(TYPE_QR) ?: ""

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarAfterScan)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        initMap()

        //Progress
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
            ,
            viewModel.getSerialId(typeQR)
                .observeOnUiThread()
                .subscribe({
                    if (it.serial == null) {
                        alertDialog(getString(R.string.afterScanErrorSerial)) {
                            onBackPressed()
                        }
                    } else {
                        keySerial = it
                        checkTypeQR(it.serial ?: "")
                        setOnClick(it.serial ?: "")
                    }
                }, this::handleError)
        )
    }

    override fun onMapReady(googleMap: GoogleMap) {
        isMapReady = true

        ggMap = googleMap
    }

    private fun initMap() {
        val supportMapFragment = SupportMapFragment()
        addFragment(R.id.childMapAfterScanContainer, supportMapFragment, null)
        supportMapFragment.getMapAsync(this)
    }

    private fun addFragment(
        @IdRes containerId: Int, fragment: SupportMapFragment, backStack: String? = null,
        t: (transaction: FragmentTransaction) -> Unit = {}
    ) {
        if (supportFragmentManager.findFragmentByTag(fragment.javaClass.simpleName) == null) {
            val transaction = supportFragmentManager.beginTransaction()
            t.invoke(transaction)
            transaction.add(containerId, fragment, fragment.javaClass.simpleName)
            if (backStack != null) {
                transaction.addToBackStack(backStack)
            }
            transaction.commit()
        }
    }

    private fun checkTypeQR(typeQR: String) {
        if (typeQR.contains(FirebaseConstance.GATE_CONS)) {
            gatewayAfterScan.visibility = View.VISIBLE
            addDisposables(
                viewModel.getDataOfGateway(typeQR)
                    .observeOnUiThread()
                    .subscribe({
                        if (it.key.isEmpty()) {
                            alertDialog(getString(R.string.afterScanErrorSerial)) {
                                onBackPressed()
                            }
                            return@subscribe
                        }
                        //KEY
                        gateId = it.key
                        //MAP
                        if (isMapReady) {
                            val position = LatLng(it.gps?.lat ?: 0.0, it.gps?.long ?: 0.0)
                            ggMap?.addMarker(
                                MarkerOptions()
                                    .position(position)
                                    .icon(BitmapDescriptorFactory.fromResource(R.drawable.ic_marker_gateway))
                            )
                            ggMap?.moveCamera(CameraUpdateFactory.newLatLng(position))
                        }
                        //DATA
                        tvItemGatewayName.text = it.name
                        tvItemGatewayDeviceCount.text =
                            getString(R.string.gatewaysFragmentTvDevices, it.devices.entries.size)
                    }, this::handleError)
            )

            return
        }
        if (typeQR.contains(FirebaseConstance.SENSOR_CONST)) {
            nodeAfterScan.visibility = View.VISIBLE
            addDisposables(
                viewModel.getDevice(typeQR)
                    .observeOnUiThread()
                    .subscribe({
                        if (it.key.isEmpty()) {
                            alertDialog(getString(R.string.afterScanErrorSerial)) {
                                onBackPressed()
                            }
                            return@subscribe
                        }
                        //KEY
                        gateId = it.owner ?: ""
                        deviceId = it.key
                        //MAP
                        if (isMapReady) {
                            val position = LatLng(it.gps?.lat ?: 0.0, it.gps?.long ?: 0.0)
                            ggMap?.addMarker(
                                MarkerOptions()
                                    .position(position)
                                    .icon(BitmapDescriptorFactory.fromResource(R.drawable.sensernode))
                            )
                            ggMap?.moveCamera(CameraUpdateFactory.newLatLng(position))
                        }
                        //DATA
                        tvItemNodeName.text = it.name
                        tvItemGatewayDeviceCount.text = DateUtils.getDiffDate(
                            it.currentData?.timestamp
                                ?: 0L, this
                        )

                    }, this::handleError)
            )
            return
        }
        if (typeQR.contains(FirebaseConstance.VALVES_CONS)) {
            valesAfterScan.visibility = View.VISIBLE

            addDisposables(
                viewModel.getDeviceValves(typeQR)
                    .observeOnUiThread()
                    .subscribe({
                        if (it.key.isEmpty()) {
                            alertDialog(getString(R.string.afterScanErrorSerial)) {
                                onBackPressed()
                            }
                            return@subscribe
                        }
                        //KEY
                        gateId = it.owner ?: ""
                        deviceId = it.key
                        //MAP
                        if (isMapReady) {
                            val position = LatLng(
                                it.gps?.lat
                                    ?: 0.0, it.gps?.long ?: 0.0
                            )
                            ggMap?.addMarker(
                                MarkerOptions()
                                    .position(position)
                                    .icon(BitmapDescriptorFactory.fromResource(R.drawable.valvescontroler))
                            )
                            ggMap?.moveCamera(CameraUpdateFactory.newLatLng(position))
                        }
                        //DATA
                        tvItemValesName.text = it.name
                        tvItemValvesCountTs.text = DateUtils.getDiffDate(
                            it.current_data?.timestamp
                                ?: 0L, this
                        )
                        tvItemValesState.text = if (it.current_data?.data == FirebaseConstance.VALVES_ON) {
                            tvItemValesState.textColor =
                                ContextCompat.getColor(this, R.color.colorValesStateOn)
                            FirebaseConstance.VALVES_ON
                        } else {
                            tvItemValesState.textColor =
                                ContextCompat.getColor(this, R.color.colorValesStateOff)
                            FirebaseConstance.VALVES_OFF
                        }

                    }, this::handleError)
            )

            return
        }
    }

    private fun setOnClick(typeQR: String) {
        btnGoToDetail.setOnClickListener {
            if (typeQR.contains(FirebaseConstance.GATE_CONS)) {
                startActivity<GatewayDetailActivity>(GatewayDetailActivity.KEY_ID_GATE_WAYS to gateId)
                return@setOnClickListener
            }
            if (typeQR.contains(FirebaseConstance.SENSOR_CONST)) {
                startActivity(
                    intentFor<DeviceLogActivity>(
                        DeviceLogActivity.TYPE_SCREEN to DeviceLogActivity.TYPE_SCREEN_NODE,
                        DeviceLogActivity.GATEWAY_ID to gateId,
                        DeviceLogActivity.DEVICE_ID to deviceId
                    )
                )
                return@setOnClickListener
            }
            if (typeQR.contains(FirebaseConstance.VALVES_CONS)) {
                startActivity(
                    intentFor<DeviceLogActivity>(
                        DeviceLogActivity.TYPE_SCREEN to DeviceLogActivity.TYPE_SCREEN_VALES,
                        DeviceLogActivity.GATEWAY_ID to gateId,
                        DeviceLogActivity.DEVICE_ID to deviceId
                    )
                )
                return@setOnClickListener
            }
        }
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    private fun handleError(throwable: Throwable) {
        alertDialog(throwable.message ?: "") {
            onBackPressed()
        }
    }
}
