package com.app.frostprotectionsystemandroid.ui.main.setting

import android.os.Bundle
import androidx.appcompat.widget.Toolbar
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import kotlinx.android.synthetic.main.activity_setting.*

class SettingActivity : BaseActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_setting)

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarSetting)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        //handleCheck
        btnEng.setOnCheckedChangeListener { buttonView, isChecked ->
            btnVn.isChecked = !isChecked
        }
        btnVn.setOnCheckedChangeListener { buttonView, isChecked ->
            btnEng.isChecked = !isChecked
        }
    }
}
