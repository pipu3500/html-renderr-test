package com.pipu.dashboard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

/**
 * Wird vom AlarmManager zum nächsten geplanten Einschalt-Zeitpunkt ausgelöst (siehe
 * Schedule.nextWakeMillis). Weckt den Bildschirm kurz per WakeLock und startet die App, deren
 * Aktivität selbst dafür sorgt, dass sie auch über einem gesperrten Bildschirm angezeigt wird.
 */
class WakeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "dashboard:wake"
        )
        wakeLock.acquire(15_000L)

        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        context.startActivity(launch)

        AlarmScheduler.scheduleNext(context)
    }
}
