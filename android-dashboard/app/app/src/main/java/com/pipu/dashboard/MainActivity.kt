package com.pipu.dashboard

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
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
    private val refreshHandler = Handler(Looper.getMainLooper())
    private var refreshRunnable: Runnable? = null
    private val scheduleHandler = Handler(Looper.getMainLooper())
    private var scheduleRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("dashboard", MODE_PRIVATE)
        webView = findViewById(R.id.webView)
        setupWebView()

        findViewById<FloatingActionButton>(R.id.menuButton).setOnClickListener { showSettingsDialog() }

        if (prefs.getString(KEY_OWNER, "").isNullOrBlank() || prefs.getString(KEY_REPO, "").isNullOrBlank()) {
            showSettingsDialog()
        } else {
            loadDashboard()
        }
    }

    override fun onResume() {
        super.onResume()
        applyScreenSchedule()
    }

    override fun onStop() {
        scheduleRunnable?.let { scheduleHandler.removeCallbacks(it) }
        super.onStop()
    }

    /** Prüft jede Minute, ob der Bildschirm laut Zeitplan (siehe Schedule.kt) wach bleiben soll. */
    private fun applyScreenSchedule() {
        scheduleRunnable?.let { scheduleHandler.removeCallbacks(it) }
        if (Schedule.isOnNow(prefs)) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
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

    /** Einfacher Einstellungsdialog: GitHub-Zugang, Gerät, Aktualisierungs-Takt. */
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
