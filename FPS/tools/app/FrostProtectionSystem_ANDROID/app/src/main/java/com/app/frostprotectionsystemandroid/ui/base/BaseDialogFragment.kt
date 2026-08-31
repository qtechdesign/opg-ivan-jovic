package com.app.frostprotectionsystemandroid.ui.base

import android.app.Dialog
import android.os.Bundle
import android.view.Window
import androidx.fragment.app.DialogFragment

/**
 *
 */
abstract class BaseDialogFragment : DialogFragment() {
    companion object {
        const val BACK_STACK_SKIP_ON_BACK = "tag_skip_on_back"
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = object : Dialog(activity, theme) {
            override fun onBackPressed() {
                if (childFragmentManager.backStackEntryCount > 0) {
                    childFragmentManager.popBackStackImmediate()
                    var count = childFragmentManager.backStackEntryCount
                    while (count > 0 &&
                        BACK_STACK_SKIP_ON_BACK == childFragmentManager.getBackStackEntryAt(count - 1).name
                    ) {
                        childFragmentManager.popBackStackImmediate()
                        count = childFragmentManager.backStackEntryCount
                    }
                } else {
                    dismiss()
                }
            }
        }
        dialog.window.requestFeature(Window.FEATURE_NO_TITLE)
        dialog.setCanceledOnTouchOutside(false)
        return dialog
    }
}
