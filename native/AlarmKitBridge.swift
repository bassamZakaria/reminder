import Foundation
#if os(iOS) && canImport(AlarmKit)
import AlarmKit
import SwiftUI
import CryptoKit

@available(iOS 26.0, *)
struct RecallAlarmMetadata: AlarmMetadata {}
#endif

@objc public class AlarmKitBridge: NSObject {
  @objc public static func isSupported() -> Bool {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) { return true }
    #endif
    return false
  }

  // AlarmKit can only express these natively; other rules fall back to notifications.
  @objc public static func supportsRepeat(_ repeatRule: String) -> Bool {
    return repeatRule == "none" || repeatRule == "daily" || repeatRule == "weekly"
  }

  @objc public static func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let state = try await AlarmManager.shared.requestAuthorization()
          completion(state == .authorized)
        } catch {
          completion(false)
        }
      }
      return
    }
    #endif
    completion(false)
  }

  @objc public static func schedule(id: String, title: String, body: String, fireAt: Date, repeatRule: String, snoozeMinutes: Int, completion: @escaping (NSError?) -> Void) {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill")
      let snooze = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
      let alert = AlarmPresentation.Alert(
        title: LocalizedStringResource(stringLiteral: title.isEmpty ? "Reminder" : title),
        stopButton: stop,
        secondaryButton: snooze,
        secondaryButtonBehavior: .countdown
      )
      let countdownTitle = LocalizedStringResource(stringLiteral: title.isEmpty ? "Reminder" : title)
      let countdown = AlarmPresentation.Countdown(title: countdownTitle, pauseButton: nil)
      let presentation = AlarmPresentation(alert: alert, countdown: countdown)
      let attributes = AlarmAttributes<RecallAlarmMetadata>(
        presentation: presentation,
        metadata: RecallAlarmMetadata(),
        tintColor: Color(red: 0.97, green: 0.65, blue: 0.10)
      )

      let schedule = makeSchedule(fireAt: fireAt, repeatRule: repeatRule)
      let configuration = AlarmManager.AlarmConfiguration(
        countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(snoozeMinutes * 60)),
        schedule: schedule,
        attributes: attributes,
        sound: .default
      )
      Task {
        do {
          _ = try await AlarmManager.shared.schedule(id: stableUUID(id), configuration: configuration)
          completion(nil)
        } catch {
          completion(error as NSError)
        }
      }
      return
    }
    #endif
    completion(NSError(domain: "AlarmKitBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "AlarmKit unavailable"]))
  }

  #if os(iOS) && canImport(AlarmKit)
  @available(iOS 26.0, *)
  private static func makeSchedule(fireAt: Date, repeatRule: String) -> Alarm.Schedule {
    let calendar = Calendar.current
    let parts = calendar.dateComponents([.hour, .minute, .weekday], from: fireAt)
    let time = Alarm.Schedule.Relative.Time(hour: parts.hour ?? 9, minute: parts.minute ?? 0)
    switch repeatRule {
    case "daily":
      let everyDay: [Locale.Weekday] = [.sunday, .monday, .tuesday, .wednesday, .thursday, .friday, .saturday]
      return .relative(Alarm.Schedule.Relative(time: time, repeats: .weekly(everyDay)))
    case "weekly":
      let weekday = weekdayFor(parts.weekday ?? 1)
      return .relative(Alarm.Schedule.Relative(time: time, repeats: .weekly([weekday])))
    default:
      return .fixed(fireAt)
    }
  }

  @available(iOS 26.0, *)
  private static func weekdayFor(_ index: Int) -> Locale.Weekday {
    switch index {
    case 1: return .sunday
    case 2: return .monday
    case 3: return .tuesday
    case 4: return .wednesday
    case 5: return .thursday
    case 6: return .friday
    default: return .saturday
    }
  }
  #endif

  @objc public static func cancel(id: String) {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      try? AlarmManager.shared.cancel(id: stableUUID(id))
    }
    #endif
  }

  @objc public static func cancelAll() {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      for alarm in (try? AlarmManager.shared.alarms) ?? [] {
        try? AlarmManager.shared.cancel(id: alarm.id)
      }
    }
    #endif
  }

  // Returns the original identifiers (as passed to schedule) of every pending alarm.
  @objc public static func pendingIdentifiers() -> [String] {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let alarms = (try? AlarmManager.shared.alarms) ?? []
      return alarms.compactMap { idMap[$0.id.uuidString] }
    }
    #endif
    return []
  }

  private static var idMap: [String: String] = [:]

  static func stableUUID(_ id: String) -> UUID {
    #if os(iOS) && canImport(AlarmKit)
    if let uuid = UUID(uuidString: id) {
      idMap[uuid.uuidString] = id
      return uuid
    }
    let digest = Insecure.MD5.hash(data: Data(id.utf8))
    var bytes = Array(digest)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    let uuid = NSUUID(uuidBytes: bytes) as UUID
    idMap[uuid.uuidString] = id
    return uuid
    #else
    return UUID()
    #endif
  }
}
