package com.bassamsalah.recall.alarms

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity

class AlarmNotificationsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
  private var listeners = 0
  private var pendingExactAlarmPromise: Promise? = null

  init {
    reactContext.addLifecycleEventListener(this)
    Notifications.ensureChannels(reactContext)
  }

  override fun getName() = "AlarmNotifications"

  @ReactMethod
  fun addListener(eventName: String) {
    listeners++
    AlarmEvents.emitter = { event, payload ->
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event.value, payload)
    }
    AlarmEvents.drain(reactContext)
    consumeLaunchIntent()
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    listeners = maxOf(0, listeners - count.toInt())
    if (listeners == 0) {
      AlarmEvents.emitter = null
    }
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasNotificationPermission()) {
      promise.resolve(NotificationManagerCompat.from(reactContext).areNotificationsEnabled())
      return
    }
    val activity = reactContext.currentActivity as? PermissionAwareActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS) { requestCode, _, results ->
      if (requestCode == REQUEST_NOTIFICATIONS) {
        promise.resolve(results.isNotEmpty() && results[0] == PackageManager.PERMISSION_GRANTED)
        true
      } else {
        false
      }
    }
  }

  @ReactMethod
  fun alarmsSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
  }

  @ReactMethod
  fun alarmPermissionStatus(promise: Promise) {
    promise.resolve(AlarmScheduler.canScheduleExact(reactContext))
  }

  // Exact alarms need the user to switch on "Alarms & reminders" for the app; resolves once they return.
  @ReactMethod
  fun requestAlarmPermission(promise: Promise) {
    if (AlarmScheduler.canScheduleExact(reactContext) || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(true)
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    pendingExactAlarmPromise?.resolve(false)
    pendingExactAlarmPromise = promise
    activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${reactContext.packageName}")))
  }

  @ReactMethod
  fun schedule(identifier: String, itemId: String, title: String, body: String, fireAt: Double, repeat: String, alertType: String, promise: Promise) {
    AlarmScheduler.schedule(
      reactContext,
      ScheduledAlert(identifier, itemId, title, body, fireAt.toLong(), RepeatRule.from(repeat), AlertType.from(alertType)),
    )
    promise.resolve(null)
  }

  @ReactMethod
  fun cancel(identifiers: ReadableArray) {
    AlarmScheduler.cancel(reactContext, (0 until identifiers.size()).mapNotNull { identifiers.getString(it) })
  }

  @ReactMethod
  fun cancelAll() {
    AlarmScheduler.cancelAll(reactContext)
  }

  @ReactMethod
  fun getPending(promise: Promise) {
    val ids = Arguments.createArray()
    AlarmScheduler.pending(reactContext).forEach { ids.pushString(it.identifier) }
    promise.resolve(ids)
  }

  @ReactMethod
  fun ackAction(eventId: String) {}

  @ReactMethod
  fun stopAlarmSound() {
    AlarmScheduler.all(reactContext).filter { it.alertType == AlertType.ALARM }.forEach { Notifications.cancel(reactContext, it.identifier) }
  }

  override fun onHostResume() {
    pendingExactAlarmPromise?.let {
      it.resolve(AlarmScheduler.canScheduleExact(reactContext))
      pendingExactAlarmPromise = null
      AlarmScheduler.rearmAll(reactContext)
    }
    consumeLaunchIntent()
  }

  override fun onHostPause() {}

  override fun onHostDestroy() {}

  private fun consumeLaunchIntent() {
    if (AlarmEvents.emitter == null) {
      return
    }
    val intent = reactContext.currentActivity?.intent ?: return
    val action = intent.getStringExtra(Notifications.EXTRA_ACTION) ?: return
    val itemId = intent.getStringExtra(Notifications.EXTRA_ITEM_ID) ?: return
    intent.removeExtra(Notifications.EXTRA_ACTION)
    AlarmEvents.action(reactContext, itemId, action)
  }

  private fun hasNotificationPermission() =
    ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

  companion object {
    private const val REQUEST_NOTIFICATIONS = 4201
  }
}
