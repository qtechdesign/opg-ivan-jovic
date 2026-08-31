package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import android.util.Log.d
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.DeviceHome
import com.app.frostprotectionsystemandroid.utils.DateUtils
import kotlinx.android.synthetic.main.item_vavles_device.view.*
import org.jetbrains.anko.textColor

/**
 *
 * @author at-tienhuynh3
 */
class TypeDeviceValesAdapter(val deviceVales: List<DeviceHome>) :
    RecyclerView.Adapter<TypeDeviceValesAdapter.GatewayViewHolder>() {

    internal var itemClick: (position: Int) -> Unit = {}

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GatewayViewHolder {
        return GatewayViewHolder(
            LayoutInflater.from(parent.context).inflate(
                R.layout.item_vavles_device,
                parent,
                false
            )
        )
    }

    override fun onBindViewHolder(holder: GatewayViewHolder, position: Int) {
        holder.bindData(deviceVales[position])
    }

    override fun getItemCount(): Int = deviceVales.size

    inner class GatewayViewHolder(private val view: View) : RecyclerView.ViewHolder(view) {

        init {
            view.setOnClickListener {
                itemClick.invoke(adapterPosition)
            }
        }

        fun bindData(deviceVavles: DeviceHome) {
            view.run {
                tvItemValesName.text = deviceVavles.name
                deviceVavles.ts?.let {
                    tvItemValvesCountTs.text = DateUtils.getDiffDate(it, itemView.context)
                }
                tvItemValesState.text =
                    if (deviceVavles.isOn) itemView.context.getString(R.string.valesDeviceON) else itemView.context.getString(
                        R.string.valesDeviceOFF
                    )
                tvItemValesState.textColor = if (deviceVavles.isOn) {
                    ContextCompat.getColor(itemView.context, R.color.colorValesStateOn)
                } else {
                    ContextCompat.getColor(itemView.context, R.color.colorValesStateOff)
                }
            }
        }
    }
}
