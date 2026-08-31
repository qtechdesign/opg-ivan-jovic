package com.app.frostprotectionsystemandroid.ui.dialog

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.Gravity
import androidx.core.content.ContextCompat
import com.app.frostprotectionsystemandroid.R
import kotlinx.android.synthetic.main.dialog_loading.*

class LoadingDialog(context: Context, private val isLogin: Boolean = false) : Dialog(context) {


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        context.setTheme(R.style.ProgressDialogTheme)
        window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        window?.attributes?.gravity = Gravity.CENTER_HORIZONTAL
        setTitle(null)
        setCancelable(false)
        setOnCancelListener(null)
        setContentView(R.layout.dialog_loading)

        if (isLogin) {
            progress.indeterminateDrawable.setColorFilter(
                ContextCompat.getColor(context, R.color.colorProgressDialog),
                PorterDuff.Mode.MULTIPLY
            )
        } else {
            progress.indeterminateDrawable.setColorFilter(
                ContextCompat.getColor(context, R.color.colorProgressEnd),
                PorterDuff.Mode.MULTIPLY
            )
        }
    }

    @Synchronized
    override fun show() {
        if (!this.isShowing) {
            super.show()
        }
    }

    @Synchronized
    override fun dismiss() {
        if (this.isShowing) {
            super.dismiss()
        }
    }
}
