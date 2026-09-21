package com.bassamsalah.recall.alarms

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

enum class AlarmEvent(val value: String) {
  NOTIFICATION_ACTION("notificationAction"),
  ALARM_FIRED("alarmFired"),
}

// Delivers events to JS when the module is listening, otherwise persists them until it starts listening.
object AlarmEvents {
  private const val PREFS = "recall_alarm_events"
  private const val KEY = "queue"

  @Volatile
  var emitter: ((AlarmEvent, WritableMap) -> Unit)? = null

  fun action(context: Context, itemId: String, action: String, snoozeUntil: Long? = null) {
    val payload = JSONObject().put("eventId", UUID.randomUUID().toString()).put("itemId", itemId).put("action", action)
    snoozeUntil?.let { payload.put("snoozeUntil", it.toDouble()) }
    deliver(context, AlarmEvent.NOTIFICATION_ACTION, payload)
  }

  fun alarmFired(context: Context, alert: ScheduledAlert) {
    deliver(context, AlarmEvent.ALARM_FIRED, JSONObject().put("itemId", alert.itemId).put("title", alert.title).put("body", alert.body))
  }

  @Synchronized
  fun drain(context: Context) {
    val emit = emitter ?: return
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(KEY, "[]"))
    prefs.edit().remove(KEY).apply()
    for (i in 0 until queue.length()) {
      val entry = queue.getJSONObject(i)
      emit(AlarmEvent.entries.first { it.value == entry.getString("event") }, toMap(entry.getJSONObject("payload")))
    }
  }

  @Synchronized
  private fun deliver(context: Context, event: AlarmEvent, payload: JSONObject) {
    val emit = emitter
    if (emit != null) {
      emit(event, toMap(payload))
      return
    }
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val queue = JSONArray(prefs.getString(KEY, "[]"))
    queue.put(JSONObject().put("event", event.value).put("payload", payload))
    prefs.edit().putString(KEY, queue.toString()).apply()
  }

  private fun toMap(json: JSONObject): WritableMap {
    val map = Arguments.createMap()
    for (key in json.keys()) {
      when (val value = json.get(key)) {
        is Number -> map.putDouble(key, value.toDouble())
        else -> map.putString(key, value.toString())
      }
    }
    return map
  }
}
