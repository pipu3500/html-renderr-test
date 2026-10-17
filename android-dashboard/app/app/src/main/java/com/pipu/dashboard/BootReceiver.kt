package com.pipu.dashboard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Alarme überleben einen Neustart nicht von selbst; nach dem Hochfahren neu einplanen. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            AlarmScheduler.scheduleNext(context)
        }
    }
}
