package com.app.frostprotectionsystemandroid.ui.main.gateways

import android.util.Log.d
import com.app.frostprotectionsystemandroid.data.model.GatewayHome
import com.app.frostprotectionsystemandroid.utils.FirebaseConstance
import io.reactivex.Observable
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
class GatewayViewModel : GatewayVMContract {

    private val gateways = mutableListOf<GatewayHome>()

    override fun getGatewaysHome(gatewaysHome: Map<String, GatewayHome>) =
        Single.create<Boolean> { emmiter ->
            gateways.clear()
            gatewaysHome.forEach { list ->
                gateways.add(GatewayHome(list.key, list.value.gatewayName, list.value.devices))
            }
            emmiter.onSuccess(true)
        }

    override fun getListGatewaysHome() = gateways

    override fun getSensorNodeNum(position: Int): Int {
        val result = mutableListOf<String>()
        gateways[position].devices.forEach {
            if (it.key.contains(FirebaseConstance.SENSOR_CONST)) {
                result.add(it.key)
            }
        }
        return result.size
    }

    override fun getValvesNum(position: Int): Int {
        val result = mutableListOf<String>()
        gateways[position].devices.forEach {
            if (it.key.contains(FirebaseConstance.VALVES_CONS)) {
                result.add(it.key)
            }
        }
        return result.size
    }

    override fun searchLocal(gatewaysHome: Map<String, GatewayHome>, textSearch: String) {
        gateways.clear()
        if (textSearch.isEmpty()) {
            gatewaysHome.forEach { list ->
                gateways.add(GatewayHome(list.key, list.value.gatewayName, list.value.devices))
            }
            return
        }
        Thread.sleep(200)
        gatewaysHome.forEach { list ->
            if (list.value.gatewayName?.toLowerCase()?.contains(textSearch.toLowerCase()) == true) {
                gateways.add(GatewayHome(list.key, list.value.gatewayName, list.value.devices))
            }
        }
    }
}

