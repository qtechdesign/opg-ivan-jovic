package com.app.frostprotectionsystemandroid.ui.main.gateways

import com.app.frostprotectionsystemandroid.data.model.GatewayHome
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
interface GatewayVMContract {

    fun getListGatewaysHome(): MutableList<GatewayHome>

    fun getGatewaysHome(gatewaysHome: Map<String, GatewayHome>): Single<Boolean>

    fun getValvesNum(position: Int): Int

    fun getSensorNodeNum(position: Int): Int

    fun searchLocal(gatewaysHome: Map<String, GatewayHome>, textSearch: String)
}