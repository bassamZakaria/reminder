import Foundation
import StoreKit
#if os(iOS)
import UIKit
#else
import AppKit
#endif

enum PurchaseStatus: String {
  case purchased, cancelled, pending
}

enum BillingPeriod: String {
  case month, year
}

enum StoreErrorCode: String {
  case productNotFound = "product_not_found"
  case unverified = "unverified_transaction"
  case noWindowScene = "no_window_scene"
}

@objc public class StoreKitBridge: NSObject {
  static let productIds: Set<String> = ["recall_premium_monthly", "recall_premium_yearly"]
  static let errorDomain = "RecallStore"
  static let manageSubscriptionsURL = URL(string: "https://apps.apple.com/account/subscriptions")!

  private static var updatesTask: Task<Void, Never>?

  static func makeError(_ code: StoreErrorCode, _ message: String) -> NSError {
    NSError(domain: errorDomain, code: 0, userInfo: [NSLocalizedDescriptionKey: message, "code": code.rawValue])
  }

  @objc public static func startListening(_ onChange: @escaping (NSDictionary) -> Void) {
    guard updatesTask == nil else { return }
    updatesTask = Task.detached {
      for await update in Transaction.updates {
        guard case .verified(let transaction) = update else { continue }
        await transaction.finish()
        onChange(await entitlement())
      }
    }
  }

  @objc public static func getProducts(_ ids: [String], completion: @escaping (NSArray?, NSError?) -> Void) {
    Task {
      do {
        let products = try await Product.products(for: ids)
        var result: [NSDictionary] = []
        for product in products {
          guard let subscription = product.subscription, let period = billingPeriod(subscription.subscriptionPeriod) else { continue }
          let trialDays = freeTrialDays(subscription.introductoryOffer)
          let eligible = trialDays != nil ? await subscription.isEligibleForIntroOffer : false
          result.append([
            "id": product.id,
            "title": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "period": period.rawValue,
            "trialDays": trialDays.map { NSNumber(value: $0) } ?? NSNull(),
            "eligibleForTrial": eligible,
          ])
        }
        completion(result as NSArray, nil)
      } catch {
        completion(nil, error as NSError)
      }
    }
  }

  @objc public static func purchase(_ productId: String, completion: @escaping (String?, NSError?) -> Void) {
    Task {
      do {
        guard let product = try await Product.products(for: [productId]).first else {
          completion(nil, makeError(.productNotFound, "Product \(productId) not found"))
          return
        }
        switch try await product.purchase() {
        case .success(let verification):
          guard case .verified(let transaction) = verification else {
            completion(nil, makeError(.unverified, "The purchase could not be verified"))
            return
          }
          await transaction.finish()
          completion(PurchaseStatus.purchased.rawValue, nil)
        case .pending:
          completion(PurchaseStatus.pending.rawValue, nil)
        case .userCancelled:
          completion(PurchaseStatus.cancelled.rawValue, nil)
        @unknown default:
          completion(PurchaseStatus.cancelled.rawValue, nil)
        }
      } catch {
        completion(nil, error as NSError)
      }
    }
  }

  @objc public static func getEntitlement(_ completion: @escaping (NSDictionary) -> Void) {
    Task {
      completion(await entitlement())
    }
  }

  @objc public static func restore(_ completion: @escaping (NSDictionary?, NSError?) -> Void) {
    Task {
      do {
        try await AppStore.sync()
        completion(await entitlement(), nil)
      } catch {
        completion(nil, error as NSError)
      }
    }
  }

  @objc public static func manageSubscriptions(_ completion: @escaping (NSError?) -> Void) {
    Task { @MainActor in
      #if os(iOS)
      let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else {
        completion(makeError(.noWindowScene, "No active window to present subscriptions"))
        return
      }
      do {
        try await AppStore.showManageSubscriptions(in: scene)
        completion(nil)
      } catch {
        completion(error as NSError)
      }
      #else
      NSWorkspace.shared.open(manageSubscriptionsURL)
      completion(nil)
      #endif
    }
  }

  static func entitlement() async -> NSDictionary {
    var best: Transaction?
    for await result in Transaction.currentEntitlements {
      guard case .verified(let transaction) = result,
            productIds.contains(transaction.productID),
            transaction.revocationDate == nil else { continue }
      if let expires = transaction.expirationDate, expires < Date() { continue }
      if best == nil || (transaction.expirationDate ?? .distantFuture) > (best?.expirationDate ?? .distantFuture) {
        best = transaction
      }
    }
    guard let transaction = best else {
      return ["active": false, "productId": NSNull(), "expiresAt": NSNull(), "inTrial": false, "willRenew": false]
    }
    let expiresAt: Any = transaction.expirationDate.map { NSNumber(value: ($0.timeIntervalSince1970 * 1000).rounded()) } ?? NSNull()
    return [
      "active": true,
      "productId": transaction.productID,
      "expiresAt": expiresAt,
      "inTrial": isIntroductory(transaction),
      "willRenew": await willAutoRenew(transaction),
    ]
  }

  static func isIntroductory(_ transaction: Transaction) -> Bool {
    if #available(iOS 17.2, macOS 14.2, *) {
      return transaction.offer?.type == .introductory
    }
    return transaction.offerType == .introductory
  }

  static func willAutoRenew(_ transaction: Transaction) async -> Bool {
    guard let product = try? await Product.products(for: [transaction.productID]).first,
          let statuses = try? await product.subscription?.status else { return true }
    for status in statuses {
      guard case .verified(let statusTransaction) = status.transaction,
            statusTransaction.originalID == transaction.originalID,
            case .verified(let renewalInfo) = status.renewalInfo else { continue }
      return renewalInfo.willAutoRenew
    }
    return true
  }

  static func billingPeriod(_ period: Product.SubscriptionPeriod) -> BillingPeriod? {
    switch period.unit {
    case .month where period.value == 1: return .month
    case .year where period.value == 1: return .year
    default: return nil
    }
  }

  static func freeTrialDays(_ offer: Product.SubscriptionOffer?) -> Int? {
    guard let offer, offer.paymentMode == .freeTrial else { return nil }
    let period = offer.period
    let unitDays: Int
    switch period.unit {
    case .day: unitDays = 1
    case .week: unitDays = 7
    case .month: unitDays = 30
    case .year: unitDays = 365
    @unknown default: unitDays = 1
    }
    return period.value * unitDays * max(offer.periodCount, 1)
  }
}
