package com.bassamsalah.recall.alarms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.bassamsalah.recall.MainActivity
import com.bassamsalah.recall.R

enum class NotificationAction(val value: String, val label: String) {
  COMPLETE("COMPLETE", "Complete"),
  SNOOZE_10("SNOOZE_10", "Snooze 10 min"),
  SNOOZE_60("SNOOZE_60", "Snooze 1 hour"),
  OPEN("com.apple.UNNotificationDefaultActionIdentifier", "Open"),
}

object Notifications {
  private const val CHANNEL_REMINDERS = "reminders"
  private const val CHANNEL_ALARMS = "alarms"
  const val EXTRA_ACTION = "action"
  const val EXTRA_ITEM_ID = "itemId"

  fun ensureChannels(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_REMINDERS, "Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Notifications for your reminders"
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ALARMS, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Reminders set to ring as an alarm"
        setSound(
          RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
          AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
        )
        enableVibration(true)
      },
    )
  }

  fun show(context: Context, alert: ScheduledAlert) {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
      return
    }
    ensureChannels(context)
    val alarm = alert.alertType == AlertType.ALARM
    val builder =
      NotificationCompat.Builder(context, if (alarm) CHANNEL_ALARMS else CHANNEL_REMINDERS)
        .setSmallIcon(R.drawable.ic_stat_reminder)
        .setContentTitle(alert.title.ifEmpty { "Reminder" })
        .setContentText(alert.body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(alert.body))
        .setCategory(if (alarm) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setAutoCancel(true)
        .setContentIntent(actionIntent(context, alert, NotificationAction.OPEN))
        .addAction(0, NotificationAction.COMPLETE.label, actionIntent(context, alert, NotificationAction.COMPLETE))
        .addAction(0, NotificationAction.SNOOZE_10.label, actionIntent(context, alert, NotificationAction.SNOOZE_10))
        .addAction(0, NotificationAction.SNOOZE_60.label, actionIntent(context, alert, NotificationAction.SNOOZE_60))
    val notification = builder.build()
    if (alarm) {
      notification.flags = notification.flags or Notification.FLAG_INSISTENT
    }
    try {
      NotificationManagerCompat.from(context).notify(alert.identifier.hashCode(), notification)
    } catch (_: SecurityException) {
    }
  }

  fun cancel(context: Context, identifier: String) {
    NotificationManagerCompat.from(context).cancel(identifier.hashCode())
  }

  private fun actionIntent(context: Context, alert: ScheduledAlert, action: NotificationAction): PendingIntent {
    val requestCode = (alert.identifier + action.value).hashCode()
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    if (action == NotificationAction.OPEN) {
      val intent =
        Intent(context, MainActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          .putExtra(EXTRA_ACTION, action.value)
          .putExtra(EXTRA_ITEM_ID, alert.itemId)
          .putExtra(AlarmScheduler.EXTRA_IDENTIFIER, alert.identifier)
      return PendingIntent.getActivity(context, requestCode, intent, flags)
    }
    val intent =
      Intent(context, ActionReceiver::class.java)
        .setAction("com.bassamsalah.recall.ACTION.${action.value}")
        .putExtra(EXTRA_ACTION, action.value)
        .putExtra(EXTRA_ITEM_ID, alert.itemId)
        .putExtra(AlarmScheduler.EXTRA_IDENTIFIER, alert.identifier)
    return PendingIntent.getBroadcast(context, requestCode, intent, flags)
  }
}
