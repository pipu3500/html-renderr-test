package com.pipu.dashboard

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.floatingactionbutton.FloatingActionButton

/**
 * Zeigt das Dashboard (android-dashboard/web/index.html, als App-Asset mitgeliefert) in einer
 * WebView an. Die Konfiguration (GitHub-Benutzername, Repository, Branch, Geräte-Kennung,
 * Aktualisierungs-Takt) wird in den App-Einstellungen eingetragen und der Seite als
 * Abfrageparameter mitgegeben; die Seite selbst lädt ihre Geräte-Einstellungen dann live von
 * jsDelivr (https://cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/android-dashboard/devices.json).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var menuButton: FloatingActionButton
    private val refreshHandler = Handler(Looper.getMainLooper())
    private var refreshRunnable: Runnable? = null
    private val scheduleHandler = Handler(Looper.getMainLooper())
    private var scheduleRunnable: Runnable? = null
    private val hideButtonHandler = Handler(Looper.getMainLooper())
    private var hideButtonRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupLockscreenWake()
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("dashboard", MODE_PRIVATE)
        webView = findViewById(R.id.webView)
        setupWebView()

        menuButton = findViewById(R.id.menuButton)
        menuButton.setOnClickListener { showSettingsDialog() }

        if (prefs.getString(KEY_OWNER, "").isNullOrBlank() || prefs.getString(KEY_REPO, "").isNullOrBlank()) {
            showSettingsDialog()
        } else {
            loadDashboard()
        }
    }

    /** Lässt die App auch über einem gesperrten Bildschirm erscheinen, wenn sie vom Weck-Alarm gestartet wird. */
    private fun setupLockscreenWake() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
    }

    override fun onResume() {
        super.onResume()
        applyScreenSchedule()
        showMenuButtonTemporarily()
    }

    override fun onStop() {
        scheduleRunnable?.let { scheduleHandler.removeCallbacks(it) }
        hideButtonRunnable?.let { hideButtonHandler.removeCallbacks(it) }
        super.onStop()
    }

    /** Jede Berührung (auch im WebView-Inhalt) zeigt den Einstellungs-Button kurz wieder an. */
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.action == MotionEvent.ACTION_DOWN) showMenuButtonTemporarily()
        return super.dispatchTouchEvent(ev)
    }

    private fun showMenuButtonTemporarily() {
        hideButtonRunnable?.let { hideButtonHandler.removeCallbacks(it) }
        menuButton.animate().cancel()
        menuButton.alpha = 1f
        menuButton.visibility = View.VISIBLE
        val r = Runnable {
            menuButton.animate().alpha(0f).setDuration(400).withEndAction { menuButton.visibility = View.INVISIBLE }.start()
        }
        hideButtonRunnable = r
        hideButtonHandler.postDelayed(r, 4000L)
    }

    /** Prüft jede Minute, ob der Bildschirm laut Zeitplan (siehe Schedule.kt) wach bleiben soll,
     *  und hält den nächsten Weck-Alarm aktuell. */
    private fun applyScreenSchedule() {
        scheduleRunnable?.let { scheduleHandler.removeCallbacks(it) }
        if (Schedule.isOnNow(prefs)) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        AlarmScheduler.scheduleNext(this)
        val r = Runnable { applyScreenSchedule() }
        scheduleRunnable = r
        scheduleHandler.postDelayed(r, 60_000L)
    }

    private fun setupWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.loadWithOverviewMode = true
        webView.settings.useWideViewPort = true
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
    }

    private fun loadDashboard() {
        val owner = prefs.getString(KEY_OWNER, "") ?: ""
        val repo = prefs.getString(KEY_REPO, "") ?: ""
        val branch = prefs.getString(KEY_BRANCH, "main") ?: "main"
        val device = prefs.getString(KEY_DEVICE, "") ?: ""
        val url = "file:///android_asset/index.html" +
            "?owner=" + java.net.URLEncoder.encode(owner, "UTF-8") +
            "&repo=" + java.net.URLEncoder.encode(repo, "UTF-8") +
            "&branch=" + java.net.URLEncoder.encode(branch, "UTF-8") +
            "&device=" + java.net.URLEncoder.encode(device, "UTF-8")
        webView.loadUrl(url)
        scheduleRefresh()
    }

    private fun scheduleRefresh() {
        refreshRunnable?.let { refreshHandler.removeCallbacks(it) }
        val minutes = prefs.getInt(KEY_INTERVAL, 15).coerceIn(1, 1440)
        val r = Runnable {
            webView.reload()
            scheduleRefresh()
        }
        refreshRunnable = r
        refreshHandler.postDelayed(r, minutes * 60_000L)
    }

    override fun onDestroy() {
        refreshRunnable?.let { refreshHandler.removeCallbacks(it) }
        super.onDestroy()
    }

    /** Einfacher Einstellungsdialog: GitHub-Zugang, Gerät, Aktualisierungs-Takt, Zeitplan, Automatisierung. */
    private fun showSettingsDialog() {
        val pad = (16 * resources.displayMetrics.density).toInt()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }

        fun field(label: String, value: String, hint: String = ""): EditText {
            layout.addView(TextView(this).apply { text = label; setPadding(0, pad / 2, 0, 0) })
            val e = EditText(this).apply {
                setText(value)
                if (hint.isNotEmpty()) this.hint = hint
            }
            layout.addView(e)
            return e
        }

        val ownerField = field(getString(R.string.settings_owner), prefs.getString(KEY_OWNER, "") ?: "", "z. B. dein-benutzername")
        val repoField = field(getString(R.string.settings_repo), prefs.getString(KEY_REPO, "") ?: "", "z. B. kindle-dashboard")
        val branchField = field(getString(R.string.settings_branch), prefs.getString(KEY_BRANCH, "main") ?: "main")
        val deviceField = field(getString(R.string.settings_device), prefs.getString(KEY_DEVICE, "") ?: "", "siehe Editor, z. B. wohnzimmer-tablet")
        val intervalField = field(
            getString(R.string.settings_interval),
            prefs.getInt(KEY_INTERVAL, 15).toString()
        ).apply { inputType = InputType.TYPE_CLASS_NUMBER }

        layout.addView(Button(this).apply {
            text = getString(R.string.settings_schedule)
            setPadding(0, pad, 0, 0)
            setOnClickListener { startActivity(Intent(this@MainActivity, ScheduleActivity::class.java)) }
        })

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
            layout.addView(Button(this).apply {
                text = getString(R.string.settings_battery)
                setPadding(0, pad / 2, 0, 0)
                setOnClickListener {
                    startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
                }
            })
        }

        if (!AlarmScheduler.canScheduleExact(this)) {
            layout.addView(Button(this).apply {
                text = getString(R.string.settings_exact_alarm)
                setPadding(0, pad / 2, 0, 0)
                setOnClickListener {
                    startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
                }
            })
        }

        val scroll = android.widget.ScrollView(this).apply {
            addView(layout)
        }
        val frame = FrameLayout(this).apply { addView(scroll) }

        AlertDialog.Builder(this)
            .setTitle(R.string.settings_title)
            .setView(frame)
            .setPositiveButton(R.string.settings_save) { _, _ ->
                prefs.edit()
                    .putString(KEY_OWNER, ownerField.text.toString().trim())
                    .putString(KEY_REPO, repoField.text.toString().trim())
                    .putString(KEY_BRANCH, branchField.text.toString().trim().ifEmpty { "main" })
                    .putString(KEY_DEVICE, deviceField.text.toString().trim())
                    .putInt(KEY_INTERVAL, intervalField.text.toString().toIntOrNull()?.coerceIn(1, 1440) ?: 15)
                    .apply()
                loadDashboard()
            }
            .setNegativeButton(R.string.settings_cancel, null)
            .show()
    }

    companion object {
        private const val KEY_OWNER = "owner"
        private const val KEY_REPO = "repo"
        private const val KEY_BRANCH = "branch"
        private const val KEY_DEVICE = "device"
        private const val KEY_INTERVAL = "interval_minutes"
    }
}
