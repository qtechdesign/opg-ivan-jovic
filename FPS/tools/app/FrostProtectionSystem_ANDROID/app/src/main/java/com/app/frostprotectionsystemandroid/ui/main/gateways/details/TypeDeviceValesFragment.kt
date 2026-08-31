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
class TypeDeviceValesFragment : BaseFragment() {
    companion object {
        internal fun newInstance(gateWayId: String): TypeDeviceValesFragment {
            val fragment = TypeDeviceValesFragment()
            Bundle().apply {
                putString(GATEWAY_ID_TYPE_VAVLES, gateWayId)
                fragment.arguments = this
            }
            return fragment
        }

        private const val GATEWAY_ID_TYPE_VAVLES = "GATEWAY_ID_TYPE_VAVLES"
    }

    private var ui: View? = null
    private lateinit var viewModel: TypeVavlesDeviceNodeVMContract
    private lateinit var adapter: TypeDeviceValesAdapter
    private var gateWayId = ""
    private var loadingDialog: LoadingDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.apply {
            gateWayId = getString(GATEWAY_ID_TYPE_VAVLES) ?: ""
        }
        context?.let {
            loadingDialog = LoadingDialog(it, false)
        }
        viewModel = TypeDeviceVavlesViewModel(DevicesRepository())
        adapter = TypeDeviceValesAdapter(viewModel.getListDeviceVavles())
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

        initRecyclerView()

        addDisposables(
                viewModel.getListDeviceVavlesSever(gateWayId)
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
                    DeviceLogActivity.TYPE_SCREEN to DeviceLogActivity.TYPE_SCREEN_VALES,
                    DeviceLogActivity.DEVICE_ID to viewModel.getListDeviceVavles()[it].key,
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
