package com.app.frostprotectionsystemandroid.ui.main.devices

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.GatewayHome
import kotlinx.android.synthetic.main.item_gate_way.view.*

/**
 *
 * @author at-tienhuynh3
 */
class DeviceAdapter(val gateways: List<GatewayHome>) : RecyclerView.Adapter<DeviceAdapter.DevicesViewHolder>() {

    internal var itemClick: (position: Int) -> Unit = {}

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): DevicesViewHolder {
        return DevicesViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_gate_way, parent, false))
    }

    override fun onBindViewHolder(holder: DevicesViewHolder, position: Int) {
        holder.bindData(gateways[position])
    }

    override fun getItemCount(): Int {
        return gateways.size
    }

    inner class DevicesViewHolder(private val view: View) : RecyclerView.ViewHolder(view) {

        init {
            view.setOnClickListener {
                itemClick.invoke(adapterPosition)
            }
        }

        fun bindData(gateway: GatewayHome) {
            view.tvItemGatewayName.text = gateway.gatewayName
            view.tvItemGatewayDeviceCount.text =
                view.context.getString(R.string.gatewaysFragmentTvDevices, gateway.devices.size)
        }
    }
}