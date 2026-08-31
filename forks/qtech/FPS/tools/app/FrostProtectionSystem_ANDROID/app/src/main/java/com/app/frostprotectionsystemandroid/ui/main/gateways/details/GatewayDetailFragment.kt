package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.extension.alertDialog
import com.app.frostprotectionsystemandroid.extension.destroy
import com.app.frostprotectionsystemandroid.extension.observeOnUiThread
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import kotlinx.android.synthetic.main.fragment_gateway_detail.*
import kotlinx.android.synthetic.main.item_sensor.*
import kotlinx.android.synthetic.main.item_valves.*

/**
 *
 * @author at-tienhuynh3
 */
class GatewayDetailFragment : BaseFragment() {

    companion object {
        internal fun newInstance(
            numSensor: Int,
            numVavles: Int,
            gatewayId: String
        ): GatewayDetailFragment {
            val fragment = GatewayDetailFragment()
            Bundle().apply {
                putInt(NUM_SENSOR_NODES_F, numSensor)
                putInt(NUM_VALVES_NODE_F, numVavles)
                putString(GATEWAY_ID_F, gatewayId)
                fragment.arguments = this
            }
            return fragment
        }

        private const val NUM_SENSOR_NODES_F = "NUM_SENSOR_NODES_F"
        private const val NUM_VALVES_NODE_F = "NUM_VALVES_NODE_F"
        private const val GATEWAY_ID_F = "GATEWAY_ID_F"
    }

    private var ui: View? = null
    private var numSensor = 0
    private var numValves = 0
    private var gatewayId = ""
    private lateinit var viewModel: GatewayDetailVMContract
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.apply {
            numSensor = getInt(NUM_SENSOR_NODES_F)
            numValves = getInt(NUM_VALVES_NODE_F)
            gatewayId = getString(GATEWAY_ID_F) ?: ""
        }

        //init VM
        context?.let {
            loadingDialog = LoadingDialog(it, false)
        }
        viewModel = GatewayDetailViewModel(GatewayRepository())
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        ui = inflater.inflate(R.layout.fragment_gateway_detail, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setData()
        setOnClick()

        if (gatewayId.isEmpty()) {
            activity?.alertDialog(getString(R.string.afterScanErrorSerial)) {
                activity?.onBackPressed()
            }
        } else {
            //Call Api
            addDisposables(
                viewModel.getGateway(gatewayId)
                    .observeOnUiThread()
                    .subscribe({
                        ui?.run {
                            (activity as? GatewayDetailActivity)?.supportActionBar?.title = it.name
                            if (viewModel.getSensorNodeNum() == 0 && viewModel.getValvesNum() == 0) {
                                itemSensor.visibility = View.GONE
                                itemValves.visibility = View.GONE
                                tvEmpty.visibility = View.VISIBLE
                            } else {
                                tvEmpty.visibility = View.GONE
                                tvItemSensorCount.text =
                                    getString(
                                        R.string.gatewaysFragmentTvDevices,
                                        viewModel.getSensorNodeNum()
                                    )
                                tvItemValvesCount.text =
                                    getString(
                                        R.string.gatewaysFragmentTvDevices,
                                        viewModel.getValvesNum()
                                    )
                                if (viewModel.getSensorNodeNum() == 0) {
                                    itemSensor.visibility = View.GONE
                                } else {
                                    itemSensor.visibility = View.VISIBLE
                                }
                                if (viewModel.getValvesNum() == 0) {
                                    itemValves.visibility = View.GONE
                                } else {
                                    itemValves.visibility = View.VISIBLE
                                }
                            }
                        }
                    }, this::handleError)
            )
        }
    }

    override fun onBindViewModel() {
        addDisposables(
            viewModel.progressSubject()
                .observeOnUiThread()
                .subscribe(this::handleProgressDialog)
        )
    }

    override fun onDestroy() {
        loadingDialog.destroy()
        super.onDestroy()
    }

    private fun setData() {
        ui?.run {
            tvItemSensorCount.text = getString(R.string.gatewaysFragmentTvDevices, numSensor)
            tvItemValvesCount.text = getString(R.string.gatewaysFragmentTvDevices, numValves)
        }
    }

    private fun setOnClick() {
        itemSensor.setOnClickListener {
            (activity as? GatewayDetailActivity)?.menuVisible(false)
            (activity as? GatewayDetailActivity)?.openTypeDeviceFragment()
        }
        itemValves.setOnClickListener {
            (activity as? GatewayDetailActivity)?.menuVisible(false)
            (activity as? GatewayDetailActivity)?.openTypeDeviceValesFragment()
        }
    }

    private fun handleProgressDialog(isShow: Boolean) {
        if (isShow && loadingDialog != null) {
            loadingDialog?.show()
        } else {
            loadingDialog?.dismiss()
        }
    }

    private fun handleError(throwable: Throwable) {
        Log.e(GatewayDetailActivity::class.java.name, throwable.message)
    }
}
