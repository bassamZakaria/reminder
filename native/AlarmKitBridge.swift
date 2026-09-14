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

  @objc public static func schedule(id: String, title: String, body: String, fireAt: Date, completion: @escaping (NSError?) -> Void) {
    #if os(iOS) && canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill")
      let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop)
      let attributes = AlarmAttributes<RecallAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: RecallAlarmMetadata(), tintColor: Color(red: 1.0, green: 0.62, blue: 0.04))
      let configuration = AlarmManager.AlarmConfiguration(schedule: .fixed(fireAt), attributes: attributes, sound: .default)
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
