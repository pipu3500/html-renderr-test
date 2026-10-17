package com.pipu.dashboard

import android.content.SharedPreferences
import java.util.Calendar

/**
 * Wöchentlicher Zeitplan: für jeden Wochentag (0 = Montag … 6 = Sonntag) eine Zeitspanne in
 * Minuten seit Mitternacht, in der der Bildschirm wach bleiben soll, plus ein Schalter, ob dieser
 * Tag überhaupt eingeschränkt wird. Start == Ende bedeutet "diesen Tag ganz aus".
 */
data class DaySchedule(val enabled: Boolean, val startMin: Int, val endMin: Int)

object Schedule {
    private const val PREFIX = "sched_day_"
    private const val KEY_MASTER = "sched_master"
    val DEFAULT = DaySchedule(enabled = false, startMin = 7 * 60, endMin = 22 * 60)

    fun isMasterEnabled(prefs: SharedPreferences): Boolean = prefs.getBoolean(KEY_MASTER, false)
    fun setMasterEnabled(prefs: SharedPreferences, on: Boolean) = prefs.edit().putBoolean(KEY_MASTER, on).apply()

    fun load(prefs: SharedPreferences, day: Int): DaySchedule {
        val raw = prefs.getString(PREFIX + day, null) ?: return DEFAULT
        val parts = raw.split(",")
        if (parts.size != 3) return DEFAULT
        val enabled = parts[0] == "1"
        val start = parts[1].toIntOrNull() ?: DEFAULT.startMin
        val end = parts[2].toIntOrNull() ?: DEFAULT.endMin
        return DaySchedule(enabled, start.coerceIn(0, 1440), end.coerceIn(0, 1440))
    }

    fun save(prefs: SharedPreferences, day: Int, value: DaySchedule) {
        prefs.edit().putString(PREFIX + day, "${if (value.enabled) 1 else 0},${value.startMin},${value.endMin}").apply()
    }

    /** true = Bildschirm soll laut Zeitplan jetzt wach gehalten werden (oder kein Zeitplan aktiv). */
    fun isOnNow(prefs: SharedPreferences, now: Calendar = Calendar.getInstance()): Boolean {
        if (!isMasterEnabled(prefs)) return true
        // Calendar.DAY_OF_WEEK: Sonntag=1 … Samstag=7 -> auf 0=Montag … 6=Sonntag umrechnen
        val cal = now.get(Calendar.DAY_OF_WEEK)
        val day = (cal + 5) % 7
        val d = load(prefs, day)
        if (!d.enabled) return true
        val minutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        if (d.startMin == d.endMin) return false
        return if (d.startMin < d.endMin) minutes in d.startMin until d.endMin
        else minutes >= d.startMin || minutes < d.endMin   // über Mitternacht hinaus (z. B. 20:00-02:00)
    }

    fun fmt(min: Int): String {
        val m = ((min % 1440) + 1440) % 1440
        return String.format("%02d:%02d", m / 60, m % 60)
    }

    /**
     * Zeitpunkt (in Millisekunden) des nächsten Wechsels von "aus" auf "an", damit das Gerät
     * dazu per Alarm geweckt werden kann. null, wenn kein Zeitplan aktiv ist oder kein Tag
     * eingeschränkt wird (dann bleibt der Bildschirm ohnehin durchgehend wach, kein Wecken nötig).
     */
    fun nextWakeMillis(prefs: SharedPreferences, from: Calendar = Calendar.getInstance()): Long? {
        if (!isMasterEnabled(prefs)) return null
        var best: Long? = null
        for (offset in 0..7) {
            val dayCal = (from.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, offset) }
            val weekday = (dayCal.get(Calendar.DAY_OF_WEEK) + 5) % 7
            val d = load(prefs, weekday)
            if (!d.enabled || d.startMin == d.endMin) continue
            val candidate = (dayCal.clone() as Calendar).apply {
                set(Calendar.HOUR_OF_DAY, d.startMin / 60)
                set(Calendar.MINUTE, d.startMin % 60)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            if (candidate.timeInMillis > from.timeInMillis) {
                val t = candidate.timeInMillis
                if (best == null || t < best!!) best = t
            }
        }
        return best
    }
}
