package com.app.frostprotectionsystemandroid.ui.main.gateways

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.model.GatewayHome
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.extension.onTextChangeListener
import com.app.frostprotectionsystemandroid.extension.scrollFloatButton
import com.app.frostprotectionsystemandroid.extension.touchHideKeyboardAllView
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.main.MainActivity
import com.app.frostprotectionsystemandroid.ui.main.gateways.details.GatewayDetailActivity
import kotlinx.android.synthetic.main.app_bar_main2.*
import kotlinx.android.synthetic.main.fragment_gateways.view.*
import org.jetbrains.anko.support.v4.intentFor


/**
 *
 * @author at-tienhuynh3
 */
class GatewaysFragment : BaseFragment() {

    companion object {
        internal fun newInstance() = GatewaysFragment()
    }

    private var ui: View? = null
    private lateinit var adapter: GatewaysAdapter
    private lateinit var viewModel: GatewayVMContract
    private var gatewayHomesLocal = mapOf<String, GatewayHome>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel = GatewayViewModel()
        adapter = GatewaysAdapter(viewModel.getListGatewaysHome())
        adapter.itemClick = this::handleItemClick
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        ui = inflater.inflate(R.layout.fragment_gateways, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        ui?.run {
            activity?.touchHideKeyboardAllView(llRootGateways)
            recyclerViewGateways.layoutManager = LinearLayoutManager(activity)
            recyclerViewGateways.adapter = adapter

            //scroll float button
            recyclerViewGateways.scrollFloatButton(
                (activity as? MainActivity)?.fabHomeGateways,
                (activity as? MainActivity)?.fabHomeGatewaysMap
            )

            searchLocal()
        }
    }

    override fun onBindViewModel() {
        //No-op
    }

    internal fun loadGatewaysHome(gatewayHomes: Map<String, GatewayHome>) {
        gatewayHomesLocal = gatewayHomes
        addDisposables(
            viewModel.getGatewaysHome(gatewayHomes)
                .observeOnUiThread()
                .subscribe({ isSuccess ->
                    if (isSuccess) {
                        adapter.notifyDataSetChanged()
                    }
                }, {})
        )
    }

    private fun handleItemClick(position: Int) {
        activity?.startActivity(
            intentFor<GatewayDetailActivity>(
                GatewayDetailActivity.KEY_ID_GATE_WAYS to viewModel.getListGatewaysHome()[position].key,
                GatewayDetailActivity.NAME_GATE_WAYS to viewModel.getListGatewaysHome()[position].gatewayName,
                GatewayDetailActivity.NUM_SENSOR_NODES to viewModel.getSensorNodeNum(position),
                GatewayDetailActivity.NUM_VALVES_NODE to viewModel.getValvesNum(position)
            )
        )
    }

    private fun searchLocal() {
        ui?.edtSearchLocal?.onTextChangeListener {
            viewModel.searchLocal(gatewayHomesLocal, it.toString())
            adapter.notifyDataSetChanged()
        }
    }
}

