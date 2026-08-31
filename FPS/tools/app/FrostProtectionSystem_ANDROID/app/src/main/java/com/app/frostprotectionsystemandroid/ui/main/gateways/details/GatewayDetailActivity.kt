package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.widget.Toolbar
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.app.frostprotectionsystemandroid.ui.main.devices.adddevice.AddNewDeviceActivity
import com.app.frostprotectionsystemandroid.ui.main.gateways.setup.SetUpGatewayActivity
import com.app.frostprotectionsystemandroid.ui.main.gateways.setup.SetUpGatewayActivity.Companion.NAME_GATE_WAY_OK_RESULT
import com.app.frostprotectionsystemandroid.ui.main.map.MapActivity
import kotlinx.android.synthetic.main.activity_gateway_detail.*
import org.jetbrains.anko.intentFor
import org.jetbrains.anko.startActivity


/**
 *
 * @author at-tienhuynh3
 */
class GatewayDetailActivity : BaseActivity() {

    companion object {
        internal const val KEY_ID_GATE_WAYS = "KEY_ID_GATE_WAYS"
        internal const val NAME_GATE_WAYS = "NAME_GATE_WAYS"
        internal const val NUM_SENSOR_NODES = "NUM_SENSOR_NODES"
        internal const val NUM_VALVES_NODE = "NUM_VALVES_NODE"
        internal const val REQUEST_CODE_SETUP = 1123
    }

    private var gatewayKeyId = ""
    private var gatewayName = ""
    private var numSensor = 0
    private var numValves = 0
    private var menuItem: MenuItem? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_gateway_detail)

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarDetailGateWay)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //Get data
        gatewayKeyId = intent?.getStringExtra(KEY_ID_GATE_WAYS) ?: ""
        gatewayName = intent?.getStringExtra(NAME_GATE_WAYS) ?: ""
        numSensor = intent?.getIntExtra(NUM_SENSOR_NODES, 0) ?: 0
        numValves = intent?.getIntExtra(NUM_VALVES_NODE, 0) ?: 0


        //Add Detail Fragment
        initDetailFragment()

        setOnClick()

        //Hide Keyboard
        touchHideKeyboardAllView(rlRootGatewayDetail)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == Activity.RESULT_OK) {
            if (requestCode == REQUEST_CODE_SETUP) {
                supportActionBar?.title = data?.getStringExtra(NAME_GATE_WAY_OK_RESULT)
            }
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        val inflater = menuInflater
        inflater.inflate(R.menu.gateway_detail, menu)
        menuItem = menu.findItem(R.id.action_settings_gateway)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem?): Boolean {
        if (item?.itemId == R.id.action_settings_gateway) {
            startActivityForResult(
                intentFor<SetUpGatewayActivity>(
                    SetUpGatewayActivity.KEY_ID_GATE_WAY to gatewayKeyId,
                    SetUpGatewayActivity.NAME_GATE_WAY to gatewayName
                ), REQUEST_CODE_SETUP
            )
            return true
        }
        return super.onOptionsItemSelected(item)

    }

    override fun onBackPressed() {
        super.onBackPressed()
        if (getCurrentFragment(R.id.gatewayDetailContainer) is GatewayDetailFragment) {
            menuVisible(true)
        }
    }

    private fun initDetailFragment() {
        if (numSensor != 0 && numValves != 0 || numSensor == 0 && numValves == 0) {
            supportActionBar?.title = gatewayName
            addFragment(
                R.id.gatewayDetailContainer,
                GatewayDetailFragment.newInstance(numSensor, numValves, gatewayKeyId),
                {},
                null
            )
        } else if (numSensor != 0 && numValves == 0) {
            openTypeDeviceFragment(false)
        } else if (numValves != 0 && numSensor == 0) {
            openTypeDeviceValesFragment(false)
        }
    }

    internal fun openTypeDeviceFragment(isBackStack: Boolean = true) {
        replaceFragment(
            R.id.gatewayDetailContainer, TypeDeviceFragment.newInstance(gatewayKeyId), {
                if (isBackStack) {
                    it.setCustomAnimationRightToLeft()
                }
            }, isBackStack
        )
    }

    internal fun openTypeDeviceValesFragment(isBackStack: Boolean = true) {
        replaceFragment(
            R.id.gatewayDetailContainer, TypeDeviceValesFragment.newInstance(gatewayKeyId), {
                if (isBackStack) {
                    it.setCustomAnimationRightToLeft()
                }
            }, isBackStack
        )
    }

    internal fun menuVisible(isShow: Boolean) {
        menuItem?.isVisible = isShow
    }

    private fun setOnClick() {
        fabDetailGatewaysAdd.setOnClickListener {
            startActivity<AddNewDeviceActivity>()
        }

        fabDetailGatewaysMap.setOnClickListener {
            startActivity<MapActivity>(
                MapActivity.TYPE_MAP to MapActivity.TYPE_MAP_DEVICE,
                MapActivity.GATEWAY_LIST to listOf(gatewayKeyId)
            )
        }
    }
}
