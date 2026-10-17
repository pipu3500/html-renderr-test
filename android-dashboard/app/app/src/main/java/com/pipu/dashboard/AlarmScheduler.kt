package com.pipu.dashboard

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * Stellt den nächsten Weck-Alarm (siehe Schedule.nextWakeMillis) beim System ein. Wird nach jeder
 * Änderung am Zeitplan, nach jedem ausgelösten Alarm und nach einem Neustart erneut aufgerufen.
 */
object AlarmScheduler {

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, WakeReceiver::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, 0, intent, flags)
    }

    /** true, wenn exakte Alarme ohne weitere Nutzerfreigabe gestellt werden können. */
    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return am.canScheduleExactAlarms()
    }

    fun scheduleNext(context: Context) {
        val prefs = context.getSharedPreferences("dashboard", Context.MODE_PRIVATE)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(context)
        am.cancel(pi)

        val next = Schedule.nextWakeMillis(prefs, Calendar.getInstance()) ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                // Keine Freigabe für exakte Alarme: ungefährer Alarm, kann vom System etwas verschoben werden.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
            }
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
        }
    }

    fun cancel(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context))
    }
}
