package com.app.frostprotectionsystemandroid.ui.main.map

import android.os.Bundle
import androidx.annotation.IdRes
import androidx.appcompat.widget.Toolbar
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentTransaction
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity

class MapActivity : BaseActivity() {

    companion object {
        internal const val TYPE_MAP = "TYPE_MAP"
        internal const val GATEWAY_LIST = "GATEWAY_LIST"
        internal const val TYPE_MAP_ALL = 0
        internal const val TYPE_MAP_GATEWAY = 1
        internal const val TYPE_MAP_DEVICE = 2
    }

    private var typeMap = 0
    private var gateWayList = arrayListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_map)

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarMap)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //Get type map
        typeMap = intent.getIntExtra(TYPE_MAP, TYPE_MAP_ALL)
        gateWayList = intent.getStringArrayListExtra(GATEWAY_LIST)
        addMapFragment()
    }

    private fun addMapFragment() {
        addFragment(R.id.mapContainer, MapFragment.newInstance(typeMap, gateWayList), {}, null)
    }

    private fun FragmentActivity.addFragment(
        @IdRes frameId: Int, fragment: MapFragment,
        transitionUnit: (transition: FragmentTransaction) -> Unit = {},
        backStack: String? = null
    ) {
        if (supportFragmentManager.findFragmentByTag(fragment.javaClass.simpleName) == null) {
            val transaction = supportFragmentManager.beginTransaction()
            transitionUnit.invoke(transaction)
            transaction.add(frameId, fragment, fragment.javaClass.simpleName)
            if (backStack != null) {
                transaction.addToBackStack(backStack)
            }
            transaction.commit()
            supportFragmentManager.executePendingTransactions()
        }
    }
}
