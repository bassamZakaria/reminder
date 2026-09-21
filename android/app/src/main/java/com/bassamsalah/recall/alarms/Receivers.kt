package com.bassamsalah.recall.alarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val identifier = intent.getStringExtra(AlarmScheduler.EXTRA_IDENTIFIER) ?: return
    val alert = AlarmScheduler.find(context, identifier) ?: return
    Notifications.show(context, alert)
    if (alert.alertType == AlertType.ALARM) {
      AlarmEvents.alarmFired(context, alert)
    }
    AlarmScheduler.advance(context, alert)
  }
}

class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val identifier = intent.getStringExtra(AlarmScheduler.EXTRA_IDENTIFIER) ?: return
    val itemId = intent.getStringExtra(Notifications.EXTRA_ITEM_ID) ?: return
    val action = intent.getStringExtra(Notifications.EXTRA_ACTION) ?: return
    Notifications.cancel(context, identifier)
    // Snoozes are armed here so they work even if the app never starts; JS later re-arms the same identifier.
    val snoozeUntil = snoozeMinutes(action)?.let { System.currentTimeMillis() + it * 60_000L }
    if (snoozeUntil != null) {
      val alert = AlarmScheduler.find(context, identifier) ?: AlarmScheduler.find(context, itemId)
      if (alert != null) {
        val target = if (alert.repeat == RepeatRule.NONE) itemId else itemId + SNOOZE_SUFFIX
        AlarmScheduler.schedule(context, alert.copy(identifier = target, fireAt = snoozeUntil, repeat = RepeatRule.NONE))
      }
    }
    AlarmEvents.action(context, itemId, action, snoozeUntil)
  }

  private fun snoozeMinutes(action: String): Int? =
    when (action) {
      NotificationAction.SNOOZE_10.value -> 10
      NotificationAction.SNOOZE_60.value -> 60
      else -> null
    }

  companion object {
    const val SNOOZE_SUFFIX = ":snooze"
  }
}

class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.rearmAll(context)
  }
}
