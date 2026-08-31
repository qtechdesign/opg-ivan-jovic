package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.app.frostprotectionsystemandroid.data.model.DeviceHome
import com.app.frostprotectionsystemandroid.utils.DateUtils
import kotlinx.android.synthetic.main.item_node_device.view.*


/**
 *
 * @author at-tienhuynh3
 */
class TypeDeviceNodeAdapter(val deviceNodes: List<DeviceHome>) : RecyclerView.Adapter<TypeDeviceNodeAdapter.GatewayViewHolder>() {

    internal var itemClick: (position: Int) -> Unit = {}

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GatewayViewHolder {
        return GatewayViewHolder(
                LayoutInflater.from(parent.context).inflate(
                        com.app.frostprotectionsystemandroid.R.layout.item_node_device,
                        parent,
                        false
                )
        )
    }

    override fun onBindViewHolder(holder: GatewayViewHolder, position: Int) {
        holder.bindData(deviceNodes[position])
    }

    override fun getItemCount(): Int = deviceNodes.size

    inner class GatewayViewHolder(private val view: View) : RecyclerView.ViewHolder(view) {

        init {
            view.setOnClickListener {
                itemClick.invoke(adapterPosition)
            }
        }

        fun bindData(deviceNodes: DeviceHome) {
            view.run {
                tvItemNodeName.text = deviceNodes.name
                deviceNodes.ts?.let {
                    tvItemGatewayDeviceTs.text = DateUtils.getDiffDate(it, itemView.context)
                }
            }
        }
    }
}
