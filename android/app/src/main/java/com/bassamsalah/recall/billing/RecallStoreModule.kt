package com.bassamsalah.recall.billing

import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

enum class ProductId(val value: String) {
  MONTHLY("recall_premium_monthly"),
  YEARLY("recall_premium_yearly");

  companion object {
    fun from(value: String?): ProductId? = entries.firstOrNull { it.value == value }
  }
}

enum class BillingPeriod(val value: String) {
  MONTH("month"),
  YEAR("year"),
}

enum class PurchaseStatus(val value: String) {
  PURCHASED("purchased"),
  CANCELLED("cancelled"),
  PENDING("pending"),
}

enum class StoreEvent(val value: String) {
  ENTITLEMENT_CHANGED("entitlementChanged"),
}

enum class StoreError(val code: String) {
  BILLING_UNAVAILABLE("E_BILLING_UNAVAILABLE"),
  SERVICE_UNAVAILABLE("E_SERVICE_UNAVAILABLE"),
  NETWORK_ERROR("E_NETWORK_ERROR"),
  PRODUCT_NOT_FOUND("E_PRODUCT_NOT_FOUND"),
  NO_ACTIVITY("E_NO_ACTIVITY"),
  PURCHASE_IN_PROGRESS("E_PURCHASE_IN_PROGRESS"),
  STORE_ERROR("E_STORE_ERROR");

  companion object {
    fun from(responseCode: Int): StoreError = when (responseCode) {
      BillingResponseCode.BILLING_UNAVAILABLE, BillingResponseCode.FEATURE_NOT_SUPPORTED -> BILLING_UNAVAILABLE
      BillingResponseCode.SERVICE_UNAVAILABLE, BillingResponseCode.SERVICE_DISCONNECTED -> SERVICE_UNAVAILABLE
      BillingResponseCode.NETWORK_ERROR -> NETWORK_ERROR
      BillingResponseCode.ITEM_UNAVAILABLE -> PRODUCT_NOT_FOUND
      else -> STORE_ERROR
    }
  }
}

class RecallStoreModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), PurchasesUpdatedListener {
  private val client: BillingClient = BillingClient.newBuilder(reactContext)
    .setListener(this)
    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
    .enableAutoServiceReconnection()
    .build()
  private val waitingForConnection = mutableListOf<Pair<() -> Unit, (BillingResult) -> Unit>>()
  private var connecting = false
  private var pendingPurchase: Promise? = null

  override fun getName() = "RecallStore"

  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Double) {}

  @ReactMethod
  fun getProducts(ids: ReadableArray, promise: Promise) {
    val productIds = (0 until ids.size()).mapNotNull { ids.getString(it) }
    if (productIds.isEmpty()) {
      promise.resolve(Arguments.createArray())
      return
    }
    queryProducts(productIds, promise) { details ->
      val result = Arguments.createArray()
      details.mapNotNull { toProductMap(it) }.forEach { result.pushMap(it) }
      promise.resolve(result)
    }
  }

  @ReactMethod
  fun purchase(productId: String, promise: Promise) {
    if (pendingPurchase != null) {
      promise.reject(StoreError.PURCHASE_IN_PROGRESS.code, "Another purchase is already in progress")
      return
    }
    queryProducts(listOf(productId), promise) { details ->
      val product = details.firstOrNull { it.productId == productId }
      val offer = product?.subscriptionOfferDetails?.let { offers -> offers.firstOrNull { hasFreeTrial(it) } ?: offers.firstOrNull { it.offerId == null } ?: offers.firstOrNull() }
      if (product == null || offer == null) {
        promise.reject(StoreError.PRODUCT_NOT_FOUND.code, "Subscription $productId is not available")
        return@queryProducts
      }
      val params = BillingFlowParams.newBuilder()
        .setProductDetailsParamsList(
          listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offer.offerToken).build()),
        )
        .build()
      UiThreadUtil.runOnUiThread {
        val activity = reactContext.currentActivity
        if (activity == null) {
          promise.reject(StoreError.NO_ACTIVITY.code, "No foreground activity to present the purchase sheet")
          return@runOnUiThread
        }
        if (pendingPurchase != null) {
          promise.reject(StoreError.PURCHASE_IN_PROGRESS.code, "Another purchase is already in progress")
          return@runOnUiThread
        }
        pendingPurchase = promise
        val launch = client.launchBillingFlow(activity, params)
        if (launch.responseCode != BillingResponseCode.OK) {
          pendingPurchase = null
          settleFailedPurchase(promise, launch)
        }
      }
    }
  }

  @ReactMethod
  fun getEntitlement(promise: Promise) {
    queryEntitlement(promise) { promise.resolve(it) }
  }

  @ReactMethod
  fun restore(promise: Promise) {
    queryEntitlement(promise) { promise.resolve(it) }
  }

  @ReactMethod
  fun manageSubscriptions(promise: Promise) {
    withClient(promise) {
      queryActivePurchases(
        onResult = { purchases -> openSubscriptionCenter(purchases.firstNotNullOfOrNull { activeProductId(it) }, promise) },
        onError = { openSubscriptionCenter(null, promise) },
      )
    }
  }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    val promise = pendingPurchase
    pendingPurchase = null
    val relevant = purchases.orEmpty().filter { purchase -> purchase.products.any { ProductId.from(it) != null } }
    when (result.responseCode) {
      BillingResponseCode.OK -> {
        relevant.forEach { acknowledge(it) }
        val status = if (relevant.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }) PurchaseStatus.PURCHASED else PurchaseStatus.PENDING
        promise?.resolve(statusMap(status))
      }
      else -> promise?.let { settleFailedPurchase(it, result) }
    }
    if (result.responseCode == BillingResponseCode.OK || result.responseCode == BillingResponseCode.ITEM_ALREADY_OWNED) {
      emitEntitlement()
    }
  }

  override fun invalidate() {
    pendingPurchase?.resolve(statusMap(PurchaseStatus.CANCELLED))
    pendingPurchase = null
    client.endConnection()
    super.invalidate()
  }

  private fun settleFailedPurchase(promise: Promise, result: BillingResult) {
    when (result.responseCode) {
      BillingResponseCode.USER_CANCELED -> promise.resolve(statusMap(PurchaseStatus.CANCELLED))
      BillingResponseCode.ITEM_ALREADY_OWNED -> promise.resolve(statusMap(PurchaseStatus.PURCHASED))
      else -> reject(promise, result)
    }
  }

  private fun withClient(promise: Promise, block: () -> Unit) {
    withClient(block) { reject(promise, it) }
  }

  @Synchronized
  private fun withClient(block: () -> Unit, onError: (BillingResult) -> Unit) {
    if (client.isReady) {
      block()
      return
    }
    waitingForConnection.add(block to onError)
    if (connecting) {
      return
    }
    connecting = true
    client.startConnection(object : BillingClientStateListener {
      override fun onBillingSetupFinished(result: BillingResult) {
        val waiting = drainWaiting()
        if (result.responseCode == BillingResponseCode.OK) {
          waiting.forEach { it.first() }
        } else {
          waiting.forEach { it.second(result) }
        }
      }

      override fun onBillingServiceDisconnected() {
        drainWaiting().forEach { it.second(BillingResult.newBuilder().setResponseCode(BillingResponseCode.SERVICE_DISCONNECTED).setDebugMessage("Billing service disconnected").build()) }
      }
    })
  }

  @Synchronized
  private fun drainWaiting(): List<Pair<() -> Unit, (BillingResult) -> Unit>> {
    connecting = false
    val waiting = waitingForConnection.toList()
    waitingForConnection.clear()
    return waiting
  }

  private fun queryProducts(ids: List<String>, promise: Promise, onResult: (List<ProductDetails>) -> Unit) {
    withClient(promise) {
      val params = QueryProductDetailsParams.newBuilder()
        .setProductList(ids.map { QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(ProductType.SUBS).build() })
        .build()
      client.queryProductDetailsAsync(params) { result, details ->
        if (result.responseCode != BillingResponseCode.OK) {
          reject(promise, result)
          return@queryProductDetailsAsync
        }
        onResult(details.productDetailsList)
      }
    }
  }

  private fun queryActivePurchases(onResult: (List<Purchase>) -> Unit, onError: (BillingResult) -> Unit) {
    client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()) { result, purchases ->
      if (result.responseCode != BillingResponseCode.OK) {
        onError(result)
        return@queryPurchasesAsync
      }
      val active = purchases.filter { activeProductId(it) != null }
      active.forEach { acknowledge(it) }
      onResult(active)
    }
  }

  private fun queryEntitlement(promise: Promise, onResult: (WritableMap) -> Unit) {
    withClient(promise) {
      queryActivePurchases(onResult = { onResult(entitlementMap(it)) }, onError = { reject(promise, it) })
    }
  }

  private fun emitEntitlement() {
    withClient({
      queryActivePurchases(onResult = { purchases ->
        if (reactContext.hasActiveReactInstance()) {
          reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(StoreEvent.ENTITLEMENT_CHANGED.value, entitlementMap(purchases))
        }
      }, onError = {})
    }, {})
  }

  private fun acknowledge(purchase: Purchase) {
    if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED || purchase.isAcknowledged) {
      return
    }
    client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()) {}
  }

  private fun activeProductId(purchase: Purchase): ProductId? =
    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) purchase.products.firstNotNullOfOrNull { ProductId.from(it) } else null

  private fun openSubscriptionCenter(productId: ProductId?, promise: Promise) {
    val uri = Uri.parse("https://play.google.com/store/account/subscriptions").buildUpon().apply {
      productId?.let { appendQueryParameter("sku", it.value) }
      appendQueryParameter("package", reactContext.packageName)
    }.build()
    UiThreadUtil.runOnUiThread {
      try {
        val activity = reactContext.currentActivity
        val intent = Intent(Intent.ACTION_VIEW, uri)
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject(StoreError.STORE_ERROR.code, "Could not open subscription management", e)
      }
    }
  }

  private fun toProductMap(product: ProductDetails): WritableMap? {
    val offers = product.subscriptionOfferDetails.orEmpty()
    val basePlan = offers.firstOrNull { it.offerId == null } ?: offers.firstOrNull() ?: return null
    val recurring = basePlan.pricingPhases.pricingPhaseList.lastOrNull { it.recurrenceMode == ProductDetails.RecurrenceMode.INFINITE_RECURRING }
      ?: basePlan.pricingPhases.pricingPhaseList.lastOrNull()
      ?: return null
    val trialPhase = offers.firstNotNullOfOrNull { offer -> offer.pricingPhases.pricingPhaseList.firstOrNull { it.priceAmountMicros == 0L } }
    return Arguments.createMap().apply {
      putString("id", product.productId)
      putString("title", product.name)
      putString("description", product.description)
      putString("displayPrice", recurring.formattedPrice)
      putString("period", periodOf(product.productId, recurring.billingPeriod).value)
      val trialDays = trialPhase?.let { isoPeriodDays(it.billingPeriod) }
      if (trialDays != null) putInt("trialDays", trialDays) else putNull("trialDays")
      putBoolean("eligibleForTrial", trialPhase != null)
    }
  }

  private fun hasFreeTrial(offer: ProductDetails.SubscriptionOfferDetails) = offer.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L }

  private fun periodOf(productId: String, isoPeriod: String): BillingPeriod = when {
    isoPeriod.contains('Y') -> BillingPeriod.YEAR
    isoPeriod.contains('M') -> BillingPeriod.MONTH
    ProductId.from(productId) == ProductId.YEARLY -> BillingPeriod.YEAR
    else -> BillingPeriod.MONTH
  }

  private fun isoPeriodDays(isoPeriod: String): Int? {
    val match = ISO_PERIOD.matchEntire(isoPeriod) ?: return null
    val (years, months, weeks, days) = match.destructured
    val total = (years.toIntOrNull() ?: 0) * 365 + (months.toIntOrNull() ?: 0) * 30 + (weeks.toIntOrNull() ?: 0) * 7 + (days.toIntOrNull() ?: 0)
    return total.takeIf { it > 0 }
  }

  private fun entitlementMap(purchases: List<Purchase>): WritableMap {
    val purchase = purchases.firstOrNull { activeProductId(it) != null }
    return Arguments.createMap().apply {
      putBoolean("active", purchase != null)
      val productId = purchase?.let { activeProductId(it) }
      if (productId != null) putString("productId", productId.value) else putNull("productId")
      putNull("expiresAt")
      putBoolean("inTrial", false)
      putBoolean("willRenew", purchase?.isAutoRenewing ?: false)
    }
  }

  private fun statusMap(status: PurchaseStatus): WritableMap = Arguments.createMap().apply { putString("status", status.value) }

  private fun reject(promise: Promise, result: BillingResult) {
    promise.reject(StoreError.from(result.responseCode).code, result.debugMessage.ifEmpty { "Google Play Billing error ${result.responseCode}" })
  }

  companion object {
    private val ISO_PERIOD = Regex("P(?:(\\d+)Y)?(?:(\\d+)M)?(?:(\\d+)W)?(?:(\\d+)D)?")
  }
}
