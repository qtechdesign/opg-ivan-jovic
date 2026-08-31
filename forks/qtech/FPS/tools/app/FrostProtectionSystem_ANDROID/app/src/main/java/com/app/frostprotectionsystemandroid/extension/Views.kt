package com.app.frostprotectionsystemandroid.extension

import android.content.Context
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton

fun EditText.onTextChangeListener(afterTextChanged: (Editable?) -> Unit = {}) {
    addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) = Unit

        override fun onTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) = Unit

        override fun afterTextChanged(p0: Editable?) {
            afterTextChanged.invoke(p0)
        }
    })
}

fun View.hideKeyboard(context: Context) {
    val imm: InputMethodManager? = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    imm?.hideSoftInputFromWindow(this.windowToken, 0)
}


internal fun RecyclerView.scrollFloatButton(vararg fabs: FloatingActionButton?) = this.addOnScrollListener(object : RecyclerView.OnScrollListener() {
    override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
        super.onScrolled(recyclerView, dx, dy)
        if (dy > 0 && fabs[0]?.visibility == View.VISIBLE) {
            fabs.forEach {
                it?.hide()
            }
        } else if (dy < 0 && fabs[0]?.visibility != View.VISIBLE) {
            fabs.forEach {
                it?.show()
            }
        }
    }
})
