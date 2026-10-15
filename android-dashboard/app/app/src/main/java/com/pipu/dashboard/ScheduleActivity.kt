package com.pipu.dashboard

import android.content.SharedPreferences
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.appcompat.widget.Toolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.slider.RangeSlider

/**
 * Einfache, sichtbare Wochenplanung: pro Tag ein Schieberegler mit zwei Griffen (von … bis),
 * dazu ein Schalter, ob der Tag überhaupt eingeschränkt wird, und zwei Schnellknöpfe
 * ("Ganztägig" / "Aus"). Die Zeiten bestimmen, wann die App den Bildschirm wach hält
 * (siehe Schedule.kt und MainActivity).
 */
class ScheduleActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private val rangeLabels = arrayOfNulls<TextView>(7)
    private val sliders = arrayOfNulls<RangeSlider>(7)
    private val daySwitches = arrayOfNulls<SwitchCompat>(7)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_schedule)
        prefs = getSharedPreferences("dashboard", MODE_PRIVATE)

        val toolbar = findViewById<Toolbar>(R.id.scheduleToolbar)
        toolbar.setNavigationIcon(android.R.drawable.ic_menu_revert)
        toolbar.setNavigationOnClickListener { finish() }

        val masterSwitch = findViewById<SwitchCompat>(R.id.masterSwitch)
        masterSwitch.isChecked = Schedule.isMasterEnabled(prefs)
        masterSwitch.setOnCheckedChangeListener { _, checked -> Schedule.setMasterEnabled(prefs, checked) }

        val container = findViewById<LinearLayout>(R.id.dayContainer)
        val dayNames = resources.getStringArray(R.array.weekdays)
        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        for (day in 0..6) {
            val current = Schedule.load(prefs, day)

            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(12), dp(16), dp(12))
            }

            val headRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            headRow.addView(TextView(this).apply {
                text = dayNames[day]
                textSize = 16f
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            val daySwitch = SwitchCompat(this).apply { isChecked = current.enabled }
            daySwitches[day] = daySwitch
            headRow.addView(daySwitch)
            card.addView(headRow)

            val rangeLabel = TextView(this).apply {
                textSize = 13f
                setTextColor(0xFF5B6B82.toInt())
                setPadding(0, dp(2), 0, 0)
            }
            rangeLabels[day] = rangeLabel
            card.addView(rangeLabel)

            val slider = RangeSlider(this).apply {
                valueFrom = 0f
                valueTo = 24f
                stepSize = 0.25f
                setValues(current.startMin / 60f, current.endMin / 60f)
            }
            sliders[day] = slider
            card.addView(slider)

            fun updateLabel() {
                val v = slider.values
                val s = (v[0] * 60).toInt()
                val e = (v[1] * 60).toInt()
                rangeLabel.text = if (s == e) getString(R.string.schedule_off)
                    else if (s == 0 && e >= 1440 - 1) getString(R.string.schedule_all_day)
                    else "${Schedule.fmt(s)} – ${Schedule.fmt(e)}"
            }
            updateLabel()
            slider.addOnChangeListener { _, _, _ -> updateLabel() }

            val presetRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, dp(4), 0, 0)
            }
            presetRow.addView(MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = getString(R.string.schedule_all_day)
                textSize = 12f
                setOnClickListener { slider.setValues(0f, 24f); updateLabel() }
            })
            presetRow.addView(MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = getString(R.string.schedule_off)
                textSize = 12f
                (layoutParams as? LinearLayout.LayoutParams)?.marginStart = dp(8)
                setOnClickListener { slider.setValues(12f, 12f); updateLabel() }
            })
            card.addView(presetRow)

            container.addView(card)
            if (day < 6) {
                container.addView(View(this).apply {
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                    setBackgroundColor(0x1A1B2430)
                })
            }
        }

        toolbar.inflateMenu(R.menu.menu_schedule)
        toolbar.setOnMenuItemClickListener {
            saveAll()
            finish()
            true
        }
    }

    private fun saveAll() {
        for (day in 0..6) {
            val slider = sliders[day] ?: continue
            val v = slider.values
            val start = (v[0] * 60).toInt().coerceIn(0, 1440)
            val end = (v[1] * 60).toInt().coerceIn(0, 1440)
            Schedule.save(prefs, day, DaySchedule(daySwitches[day]?.isChecked == true, start, end))
        }
    }

    override fun onPause() {
        saveAll()
        super.onPause()
    }
}
