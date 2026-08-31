package com.app.frostprotectionsystemandroid.ui.main.scan

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.widget.Toolbar
import com.app.frostprotectionsystemandroid.R
import com.app.frostprotectionsystemandroid.ui.base.BaseActivity
import com.google.zxing.Result
import kotlinx.android.synthetic.main.activity_scan.*
import me.dm7.barcodescanner.zxing.ZXingScannerView
import org.jetbrains.anko.intentFor


class ScanActivity : BaseActivity(), ZXingScannerView.ResultHandler {

    companion object {
        internal const val RESULT_QR = "RESULT_QR"
        internal const val TYPE_SCREEN = "TYPE_SCREEN"
        internal const val TYPE_SCREEN_ADD = 1
        internal const val TYPE_SCREEN_HOME = 2
    }

    private var typeScreen: Int = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(R.anim.slide_in, R.anim.slide_out)
        setContentView(R.layout.activity_scan)

        typeScreen = intent?.getIntExtra(TYPE_SCREEN, TYPE_SCREEN_ADD) ?: TYPE_SCREEN_ADD

        //Init toolbar
        val toolbar: Toolbar = findViewById(R.id.toolbarScan)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        startScanner()

        setOnClick()
    }

    private fun startScanner() {
        scanner.setResultHandler(this)
        scanner.startCamera()
        scanner.setAutoFocus(true)
    }

    private fun setOnClick() {
        btnFlashScan.setOnClickListener {
            scanner.flash = !scanner.flash
        }
    }

    override fun handleResult(rawResult: Result?) {
        val text = rawResult?.text ?: ""
        if (typeScreen == TYPE_SCREEN_ADD) {
            val returnIntent = Intent()
            returnIntent.putExtra(RESULT_QR, text)
            setResult(Activity.RESULT_OK, returnIntent)
            finish()
            return
        }
        startActivity(intentFor<AfterScanActivity>(AfterScanActivity.TYPE_QR to text))
        finish()
    }

    override fun onDestroy() {
        if (scanner.flash) {
            scanner.flash = false
        }
        super.onDestroy()
    }

}
