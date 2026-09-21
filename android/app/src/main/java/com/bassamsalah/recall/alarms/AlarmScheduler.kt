package com.bassamsalah.recall.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.util.Calendar

enum class RepeatRule(val value: String) {
  NONE("none"),
  HOURLY("hourly"),
  DAILY("daily"),
  WEEKLY("weekly"),
  MONTHLY("monthly"),
  YEARLY("yearly");

  companion object {
    fun from(value: String?): RepeatRule = entries.firstOrNull { it.value == value } ?: NONE
  }
}

enum class AlertType(val value: String) {
  NOTIFICATION("notification"),
  ALARM("alarm");

  companion object {
    fun from(value: String?): AlertType = entries.firstOrNull { it.value == value } ?: NOTIFICATION
  }
}

data class ScheduledAlert(
  val identifier: String,
  val itemId: String,
  val title: String,
  val body: String,
  val fireAt: Long,
  val repeat: RepeatRule,
  val alertType: AlertType,
) {
  fun toJson(): JSONObject =
    JSONObject()
      .put("identifier", identifier)
      .put("itemId", itemId)
      .put("title", title)
      .put("body", body)
      .put("fireAt", fireAt)
      .put("repeat", repeat.value)
      .put("alertType", alertType.value)

  companion object {
    fun fromJson(json: JSONObject) =
      ScheduledAlert(
        identifier = json.getString("identifier"),
        itemId = json.getString("itemId"),
        title = json.optString("title"),
        body = json.optString("body"),
        fireAt = json.getLong("fireAt"),
        repeat = RepeatRule.from(json.optString("repeat")),
        alertType = AlertType.from(json.optString("alertType")),
      )
  }
}

object AlarmScheduler {
  private const val PREFS = "recall_alarms"
  const val EXTRA_IDENTIFIER = "identifier"
  private const val FIRED_RETENTION_MS = 24 * 60 * 60 * 1000L

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun all(context: Context): List<ScheduledAlert> =
    prefs(context).all.values.mapNotNull { raw -> runCatching { ScheduledAlert.fromJson(JSONObject(raw as String)) }.getOrNull() }

  fun pending(context: Context): List<ScheduledAlert> {
    val now = System.currentTimeMillis()
    val (live, fired) = all(context).partition { it.fireAt > now || it.repeat != RepeatRule.NONE }
    val expired = fired.filter { it.fireAt < now - FIRED_RETENTION_MS }.map { it.identifier }
    if (expired.isNotEmpty()) {
      prefs(context).edit().apply { expired.forEach { remove(it) } }.apply()
    }
    return live
  }

  fun find(context: Context, identifier: String): ScheduledAlert? =
    prefs(context).getString(identifier, null)?.let { ScheduledAlert.fromJson(JSONObject(it)) }

  fun canScheduleExact(context: Context): Boolean {
    val manager = context.getSystemService(AlarmManager::class.java)
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
  }

  fun schedule(context: Context, alert: ScheduledAlert) {
    prefs(context).edit().putString(alert.identifier, alert.toJson().toString()).apply()
    arm(context, alert)
  }

  fun arm(context: Context, alert: ScheduledAlert) {
    val manager = context.getSystemService(AlarmManager::class.java)
    val fireIntent = pendingIntent(context, alert.identifier)
    val triggerAt = maxOf(alert.fireAt, System.currentTimeMillis() + 1_000)
    when {
      !canScheduleExact(context) -> manager.setWindow(AlarmManager.RTC_WAKEUP, triggerAt, 60_000, fireIntent)
      alert.alertType == AlertType.ALARM -> {
        val show = PendingIntent.getActivity(context, 0, context.packageManager.getLaunchIntentForPackage(context.packageName), PendingIntent.FLAG_IMMUTABLE)
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), fireIntent)
      }
      else -> manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, fireIntent)
    }
  }

  fun cancel(context: Context, identifiers: Collection<String>) {
    val manager = context.getSystemService(AlarmManager::class.java)
    val editor = prefs(context).edit()
    for (identifier in identifiers) {
      manager.cancel(pendingIntent(context, identifier))
      editor.remove(identifier)
      Notifications.cancel(context, identifier)
    }
    editor.apply()
  }

  fun cancelAll(context: Context) = cancel(context, all(context).map { it.identifier })

  fun rearmAll(context: Context) {
    val now = System.currentTimeMillis()
    for (alert in all(context)) {
      if (alert.fireAt > now || alert.repeat != RepeatRule.NONE) {
        schedule(context, alert.copy(fireAt = nextFireAt(alert.fireAt, alert.repeat, now)))
      }
    }
  }

  // Fired one-shots stay stored so a later Snooze action can rebuild them; JS sync removes them once stale.
  fun advance(context: Context, alert: ScheduledAlert) {
    if (alert.repeat == RepeatRule.NONE) {
      return
    }
    schedule(context, alert.copy(fireAt = nextFireAt(alert.fireAt, alert.repeat, System.currentTimeMillis())))
  }

  fun nextFireAt(from: Long, repeat: RepeatRule, now: Long): Long {
    if (repeat == RepeatRule.NONE) {
      return from
    }
    val calendar = Calendar.getInstance().apply { timeInMillis = from }
    var guard = 0
    while (calendar.timeInMillis <= now && guard < 100_000) {
      when (repeat) {
        RepeatRule.HOURLY -> calendar.add(Calendar.HOUR_OF_DAY, 1)
        RepeatRule.DAILY -> calendar.add(Calendar.DAY_OF_MONTH, 1)
        RepeatRule.WEEKLY -> calendar.add(Calendar.WEEK_OF_YEAR, 1)
        RepeatRule.MONTHLY -> calendar.add(Calendar.MONTH, 1)
        RepeatRule.YEARLY -> calendar.add(Calendar.YEAR, 1)
        RepeatRule.NONE -> return from
      }
      guard++
    }
    return calendar.timeInMillis
  }

  private fun pendingIntent(context: Context, identifier: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).setAction("com.bassamsalah.recall.FIRE.$identifier").putExtra(EXTRA_IDENTIFIER, identifier)
    return PendingIntent.getBroadcast(context, identifier.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
