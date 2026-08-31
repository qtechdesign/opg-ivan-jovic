package com.app.frostprotectionsystemandroid.ui.main.map

import android.graphics.Bitmap
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.IdRes
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentTransaction
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.GPS
import com.app.frostprotectionsystemandroid.data.model.MapData
import com.app.frostprotectionsystemandroid.data.model.MarkerWithId
import com.app.frostprotectionsystemandroid.data.source.repository.MapRepository
import com.app.frostprotectionsystemandroid.extension.alertDialog
import com.app.frostprotectionsystemandroid.extension.destroy
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.gateways.details.GatewayDetailActivity
import com.app.frostprotectionsystemandroid.ui.main.logs.DeviceLogActivity
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import kotlinx.android.synthetic.main.fragment_map.*
import org.jetbrains.anko.support.v4.intentFor


/**
 *
 * @author at-tienhuynh3
 */
open class MapFragment : BaseFragment(), OnMapReadyCallback, GoogleMap.OnMarkerClickListener {

    companion object {
        internal fun newInstance(typeMap: Int, gatewayIds: ArrayList<String>): MapFragment {
            val fragment = MapFragment()
            Bundle().apply {
                putInt(MapActivity.TYPE_MAP, typeMap)
                putStringArrayList(MapActivity.GATEWAY_LIST, gatewayIds)
                fragment.arguments = this
            }
            return fragment
        }
    }

    private var ui: View? = null
    private var ggMap: GoogleMap? = null
    private var typeMap = 0
    private var gatewayIds = mutableListOf<String>()
    private lateinit var viewModel: MapVMContract
    private var loadingDialog: LoadingDialog? = null
    private var mapDataList = mutableListOf<MapData>()
    private var markerList = mutableListOf<MarkerWithId>()
    private var isMapTypeDefault = true

    override fun onStart() {
        super.onStart()
        arguments?.apply {
            typeMap = getInt(MapActivity.TYPE_MAP)
            gatewayIds = getStringArrayList(MapActivity.GATEWAY_LIST) ?: mutableListOf()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        context?.let {
            loadingDialog = LoadingDialog(it, false)
            viewModel = MapViewModel(MapRepository())
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        ui = inflater.inflate(R.layout.fragment_map, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        initMap()
        initListeners()
        handleBorderImageMapType()
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        mapDataList.clear()
        super.onDestroy()
    }

    override fun onMapReady(googleMap: GoogleMap) {
        ggMap = googleMap

        mapDataList.clear()
        if (gatewayIds.isNotEmpty()) {
            gatewayIds.forEachIndexed { index, id ->
                addDisposables(
                    viewModel.getMapData(id)
                        .observeOnUiThread()
                        .subscribe(this::handleGetMapDataSuccess) {
                            handleGetMapDataError(
                                it, index
                            )
                        }
                )
            }
        } else {
            activity?.alertDialog(activity?.getString(R.string.mapActivityErrorEmpty) ?: "") {
                activity?.onBackPressed()
            }
        }
    }

    override fun onBindViewModel() {
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )
    }

    override fun onMarkerClick(marker: Marker): Boolean {
        markerList.forEach {
            if (it.marker == marker) {
                if (it.isGateway && it.gatewayId.contains(FirebaseConstance.GATE_CONS)) {
                    activity?.startActivity(
                        intentFor<GatewayDetailActivity>(
                            GatewayDetailActivity.KEY_ID_GATE_WAYS to it.gatewayId,
                            GatewayDetailActivity.NAME_GATE_WAYS to viewModel.getGatewayName(
                                it.gatewayId,
                                mapDataList
                            ),
                            GatewayDetailActivity.NUM_SENSOR_NODES to viewModel.getSensorNodeNum(
                                it.gatewayId,
                                mapDataList
                            ),
                            GatewayDetailActivity.NUM_VALVES_NODE to viewModel.getValvesNum(
                                it.gatewayId,
                                mapDataList
                            )
                        )
                    )
                    return true
                }
                if (!it.isGateway && it.deviceId.contains(FirebaseConstance.SENSOR_CONST)) {
                    startActivity(
                        intentFor<DeviceLogActivity>(
                            DeviceLogActivity.DEVICE_ID to it.deviceId,
                            DeviceLogActivity.TYPE_SCREEN to DeviceLogActivity.TYPE_SCREEN_NODE,
                            DeviceLogActivity.GATEWAY_ID to it.gatewayId
                        )
                    )
                    return true
                }
                if (!it.isGateway && it.deviceId.contains(FirebaseConstance.VALVES_CONS)) {
                    startActivity(
                        intentFor<DeviceLogActivity>(
                            DeviceLogActivity.DEVICE_ID to it.deviceId,
                            DeviceLogActivity.TYPE_SCREEN to DeviceLogActivity.TYPE_SCREEN_VALES,
                            DeviceLogActivity.GATEWAY_ID to it.gatewayId
                        )
                    )
                    return true
                }
            }
        }
        return true
    }

    private fun initListeners() {
        btnOpenMapType.setOnClickListener {
            ctrlMapType.visibility = View.VISIBLE
        }
        imgTypeMapSatellite.setOnClickListener {
            ctrlMapType.visibility = View.GONE
            //Change map type to -> satellite
            isMapTypeDefault = false
            handleBorderImageMapType()
            ggMap?.mapType = GoogleMap.MAP_TYPE_SATELLITE
        }
        imgTypeMapDefault.setOnClickListener {
            ctrlMapType.visibility = View.GONE
            //Change map type to -> default
            isMapTypeDefault = true
            handleBorderImageMapType()
            ggMap?.mapType = GoogleMap.MAP_TYPE_NORMAL
        }
    }

    private fun initMap() {
        val supportMapFragment = SupportMapFragment()
        addChildFragment(
            R.id.childMapContainer, supportMapFragment
        )
        supportMapFragment.getMapAsync(this)
    }

    private fun Fragment.addChildFragment(
        @IdRes containerId: Int, fragment: SupportMapFragment, backStack: String? = null,
        t: (transaction: FragmentTransaction) -> Unit = {}
    ) {
        if (childFragmentManager.findFragmentByTag(fragment.javaClass.simpleName) == null) {
            val transaction = childFragmentManager.beginTransaction()
            t.invoke(transaction)
            transaction.add(containerId, fragment, fragment.javaClass.simpleName)
            if (backStack != null) {
                transaction.addToBackStack(backStack)
            }
            transaction.commit()
        }
    }

    private fun addMarkerByTypeMap(
        gatewayId: String,
        deviceId: String,
        googleMap: GoogleMap,
        gps: GPS?,
        iconType: Int,
        isGateway: Boolean,
        title: String
    ) {
        gps?.let { gpsData ->
            markerList.add(
                MarkerWithId(
                    gatewayId, deviceId, googleMap.addMarker(
                        MarkerOptions()
                            .position(LatLng(gpsData.lat ?: 0.0, gpsData.long ?: 0.0))
                            .snippet(title)
                            .icon(BitmapDescriptorFactory.fromBitmap(customMarker(iconType, title)))
                    )
                    , isGateway
                )
            )
            googleMap.animateCamera(
                CameraUpdateFactory.newLatLngZoom(
                    LatLng(gpsData.lat ?: 0.0, gpsData.long ?: 0.0), 15F
                )
            )
        }
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun handleGetMapDataSuccess(mapData: MapData) {
        mapDataList.add(mapData)

        ggMap?.let {

            when (typeMap) {
                MapActivity.TYPE_MAP_ALL -> {
                    //Gateway
                    mapData.gps?.let { gps ->
                        addMarkerByTypeMap(
                            mapData.key,
                            "",
                            it,
                            gps,
                            R.drawable.ic_marker_gateway,
                            true,
                            mapData.name ?: ""
                        )
                    }
                    //Device
                    mapData.devices.forEach { device ->
                        if (device.key.contains(FirebaseConstance.SENSOR_CONST)) {
                            addMarkerByTypeMap(
                                mapData.key,
                                device.key,
                                it,
                                device.value.gps ?: GPS(),
                                R.drawable.sensernode
                                , false,
                                device.value.name ?: ""
                            )
                        } else if (device.key.contains(FirebaseConstance.VALVES_CONS)) {
                            addMarkerByTypeMap(
                                mapData.key,
                                device.key,
                                it,
                                device.value.gps ?: GPS(),
                                R.drawable.valvescontroler, false,
                                device.value.name ?: ""
                            )
                        }
                    }
                }
                MapActivity.TYPE_MAP_GATEWAY -> {
                    //Gateway
                    mapData.gps?.let { gps ->
                        addMarkerByTypeMap(
                            mapData.key,
                            "",
                            it,
                            gps,
                            R.drawable.ic_marker_gateway,
                            true,
                            mapData.name ?: ""
                        )
                    }

                }
                MapActivity.TYPE_MAP_DEVICE -> {
                    //Device
                    mapData.devices.forEach { device ->
                        if (device.key.contains(FirebaseConstance.SENSOR_CONST)) {
                            addMarkerByTypeMap(
                                "",
                                device.key,
                                it,
                                device.value.gps ?: GPS(),
                                R.drawable.sensernode,
                                false,
                                device.value.name ?: ""
                            )
                        } else if (device.key.contains(FirebaseConstance.VALVES_CONS)) {
                            addMarkerByTypeMap(
                                "",
                                device.key,
                                it,
                                device.value.gps ?: GPS(),
                                R.drawable.valvescontroler, false,
                                device.value.name ?: ""
                            )
                        }
                    }
                }
                else -> {
                    //No-op
                }
            }
            it.setOnMarkerClickListener(this)
        }
    }

    private fun handleGetMapDataError(throwable: Throwable, position: Int) {
        if (position == gatewayIds.size - 1) {
            activity?.alertDialog(throwable.message.toString()) {
                activity?.onBackPressed()
            }
        }
    }

    private fun handleBorderImageMapType() {
        if (isMapTypeDefault) {
            imgTypeMapDefault.background =
                ContextCompat.getDrawable(requireContext(), R.drawable.bg_boder_image)
            imgTypeMapSatellite.background = null
        } else {
            imgTypeMapDefault.background =
                null
            imgTypeMapSatellite.background =
                ContextCompat.getDrawable(requireContext(), R.drawable.bg_boder_image)

        }
    }

    private fun customMarker(iconType: Int, name: String): Bitmap {
        val view = LayoutInflater.from(context)
            .inflate(R.layout.layout_custom_marker, LinearLayout(context), false)
        view.findViewById<TextView>(R.id.tvNameMarker).run { text = name }
        view.findViewById<ImageView>(R.id.imgMarker)
            .run { setImageDrawable(ContextCompat.getDrawable(requireContext(), iconType)) }
        view.measure(
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        view.layout(0, 0, view.measuredWidth, view.measuredHeight)
        view.buildDrawingCache()
        return view.drawingCache
    }
}
