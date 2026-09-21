#import "RecallStore.h"
#if __has_include(<AlarmNotifications/AlarmNotifications-Swift.h>)
#import <AlarmNotifications/AlarmNotifications-Swift.h>
#else
#import "AlarmNotifications-Swift.h"
#endif

static NSString *const kEntitlementChanged = @"entitlementChanged";

@implementation RecallStore {
  BOOL _observing;
}

RCT_EXPORT_MODULE(RecallStore);

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents { return @[kEntitlementChanged]; }

- (instancetype)init {
  if (self = [super init]) {
    __weak RecallStore *weakSelf = self;
    [StoreKitBridge startListening:^(NSDictionary *entitlement) {
      [weakSelf emitEntitlement:entitlement];
    }];
  }
  return self;
}

- (void)startObserving { _observing = YES; }

- (void)stopObserving { _observing = NO; }

- (void)emitEntitlement:(NSDictionary *)entitlement {
  if (_observing) {
    [self sendEventWithName:kEntitlementChanged body:entitlement];
  }
}

RCT_EXPORT_METHOD(getProducts:(NSArray<NSString *> *)ids resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [StoreKitBridge getProducts:ids completion:^(NSArray *products, NSError *error) {
    if (error) { reject(@"products_error", error.localizedDescription, error); return; }
    resolve(products);
  }];
}

RCT_EXPORT_METHOD(purchase:(NSString *)productId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [StoreKitBridge purchase:productId completion:^(NSString *status, NSError *error) {
    if (error) { reject(error.userInfo[@"code"] ?: @"purchase_error", error.localizedDescription, error); return; }
    resolve(@{ @"status": status });
  }];
}

RCT_EXPORT_METHOD(getEntitlement:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [StoreKitBridge getEntitlement:^(NSDictionary *entitlement) {
    resolve(entitlement);
  }];
}

RCT_EXPORT_METHOD(restore:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [StoreKitBridge restore:^(NSDictionary *entitlement, NSError *error) {
    if (error) { reject(@"restore_error", error.localizedDescription, error); return; }
    resolve(entitlement);
  }];
}

RCT_EXPORT_METHOD(manageSubscriptions:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [StoreKitBridge manageSubscriptions:^(NSError *error) {
    if (error) { reject(error.userInfo[@"code"] ?: @"manage_error", error.localizedDescription, error); return; }
    resolve(nil);
  }];
}

@end
