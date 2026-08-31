package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.extension.*
import com.app.frostprotectionsystemandroid.ui.base.BaseFragment
import com.app.frostprotectionsystemandroid.ui.dialog.LoadingDialog
import com.app.frostprotectionsystemandroid.ui.main.logs.DeviceLogActivity
import kotlinx.android.synthetic.main.activity_gateway_detail.*
import kotlinx.android.synthetic.main.fragment_gateway_type_device.*
import org.jetbrains.anko.support.v4.intentFor

/**
 *
 * @author at-tienhuynh3
 */
class TypeDeviceFragment : BaseFragment() {
    companion object {
        internal fun newInstance(gateWayId: String): TypeDeviceFragment {
            val fragment = TypeDeviceFragment()
            Bundle().apply {
                putString(GATEWAY_ID_TYPE, gateWayId)
                fragment.arguments = this
            }
            return fragment
        }

        private const val GATEWAY_ID_TYPE = "GATEWAY_ID_TYPE"
    }

    private var ui: View? = null
    private lateinit var adapter: TypeDeviceNodeAdapter
    private lateinit var viewModel: TypeDeviceNodeViewModel
    private var gateWayId = ""
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        arguments?.apply {
            gateWayId = getString(GATEWAY_ID_TYPE) ?: ""
        }
        context?.let {
            loadingDialog = LoadingDialog(it, false)
        }
        viewModel = TypeDeviceNodeViewModel(DevicesRepository())
        adapter = TypeDeviceNodeAdapter(viewModel.getListDeviceNode())
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        ui = inflater.inflate(R.layout.fragment_gateway_type_device, container, false)
        return ui
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        //keyboard
        activity?.touchHideKeyboardAllView(llRootTypeDevices)

        //init
        initRecyclerView()

        addDisposables(
            viewModel.getListDeviceNode(gateWayId)
                .observeOnUiThread()
                .subscribe({ handleGetListNodeSuccess() }, this::handleGetListNodeError)

        )

        //scroll float button
        recyclerViewTypeDevice.scrollFloatButton(
            (activity as? GatewayDetailActivity)?.fabDetailGatewaysAdd,
            (activity as? GatewayDetailActivity)?.fabDetailGatewaysMap
        )

        searchLocal()

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

    private fun initRecyclerView() {
        recyclerViewTypeDevice.layoutManager = LinearLayoutManager(context)
        recyclerViewTypeDevice.adapter = adapter
        adapter.itemClick = {
            startActivity(
                intentFor<DeviceLogActivity>(
                    DeviceLogActivity.DEVICE_ID to viewModel.getListDeviceNode()[it].key,
                    DeviceLogActivity.TYPE_SCREEN to DeviceLogActivity.TYPE_SCREEN_NODE,
                    DeviceLogActivity.GATEWAY_ID to gateWayId
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

    private fun handleGetListNodeSuccess() {
        adapter.notifyDataSetChanged()
    }

    private fun handleGetListNodeError(throwable: Throwable) {
        activity?.alertDialog(throwable.message ?: "") {
            activity?.onBackPressed()
        }
    }

    private fun searchLocal() {
        ui?.run {
            edtNodeSearchLocal?.onTextChangeListener {
                viewModel.searchLocal(it.toString())
                adapter.notifyDataSetChanged()
            }
        }
    }
}