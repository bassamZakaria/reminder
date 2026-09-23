#import "AlarmNotifications.h"
#import "AlarmNotificationsDelegate.h"
#import <UserNotifications/UserNotifications.h>
#import <TargetConditionals.h>
#if __has_include(<AlarmNotifications/AlarmNotifications-Swift.h>)
#import <AlarmNotifications/AlarmNotifications-Swift.h>
#else
#import "AlarmNotifications-Swift.h"
#endif

static NSString *const kCategory = @"RECALL_REMINDER";
NSString *const kActionComplete = @"COMPLETE";
NSString *const kActionSnooze10 = @"SNOOZE_10";
NSString *const kActionSnooze60 = @"SNOOZE_60";

@implementation AlarmNotifications {
  BOOL _observing;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents { return @[@"notificationAction", @"alarmFired"]; }

- (instancetype)init {
  if (self = [super init]) {
    [AlarmNotificationsDelegate shared].module = self;
    [self registerCategory];
  }
  return self;
}

- (void)registerCategory {
  UNNotificationAction *complete = [UNNotificationAction actionWithIdentifier:kActionComplete title:@"Complete" options:UNNotificationActionOptionNone];
  UNNotificationAction *snooze10 = [UNNotificationAction actionWithIdentifier:kActionSnooze10 title:@"Snooze 10 min" options:UNNotificationActionOptionNone];
  UNNotificationAction *snooze60 = [UNNotificationAction actionWithIdentifier:kActionSnooze60 title:@"Snooze 1 hour" options:UNNotificationActionOptionNone];
  UNNotificationCategory *category = [UNNotificationCategory categoryWithIdentifier:kCategory
                                                                            actions:@[complete, snooze10, snooze60]
                                                                  intentIdentifiers:@[]
                                                                            options:UNNotificationCategoryOptionNone];
  [[UNUserNotificationCenter currentNotificationCenter] setNotificationCategories:[NSSet setWithObject:category]];
}

- (void)startObserving {
  _observing = YES;
  AlarmNotificationsDelegate *delegate = [AlarmNotificationsDelegate shared];
  NSArray *actions = [delegate.pendingActions copy];
  [delegate.pendingActions removeAllObjects];
  for (NSDictionary *event in actions) {
    [self sendEventWithName:@"notificationAction" body:event];
  }
  NSArray *alarms = [delegate.pendingAlarms copy];
  [delegate.pendingAlarms removeAllObjects];
  for (NSDictionary *event in alarms) {
    [self sendEventWithName:@"alarmFired" body:event];
  }
}

- (void)stopObserving { _observing = NO; }

- (void)emitAction:(NSDictionary *)event {
  if (_observing) {
    [self sendEventWithName:@"notificationAction" body:event];
  } else {
    [[AlarmNotificationsDelegate shared].pendingActions addObject:event];
  }
}

- (void)emitAlarm:(NSDictionary *)event {
  if (_observing) {
    [self sendEventWithName:@"alarmFired" body:event];
  } else {
    [[AlarmNotificationsDelegate shared].pendingAlarms addObject:event];
  }
}

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge;
  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:options completionHandler:^(BOOL granted, NSError *error) {
    if (error) { reject(@"permission_error", error.localizedDescription, error); return; }
    resolve(@(granted));
  }];
}

RCT_EXPORT_METHOD(alarmsSupported:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@([AlarmKitBridge isSupported]));
}

RCT_EXPORT_METHOD(alarmPermissionStatus:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve([AlarmKitBridge isSupported] ? (id)@([AlarmKitBridge isAuthorized]) : (id)[NSNull null]);
}

RCT_EXPORT_METHOD(requestAlarmPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [AlarmKitBridge requestAuthorization:^(BOOL granted) {
    resolve(@(granted));
  }];
}

RCT_EXPORT_METHOD(schedule:(NSString *)identifier
                  itemId:(NSString *)itemId
                  title:(NSString *)title
                  body:(NSString *)body
                  fireAt:(double)fireAtMs
                  repeat:(NSString *)repeat
                  alertType:(NSString *)alertType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSDate *fireDate = [NSDate dateWithTimeIntervalSince1970:fireAtMs / 1000.0];
  BOOL wantsAlarm = [alertType isEqualToString:@"alarm"];

  if (wantsAlarm && [AlarmKitBridge isSupported] && [AlarmKitBridge isAuthorized] && [AlarmKitBridge supportsRepeat:repeat]) {
    [[UNUserNotificationCenter currentNotificationCenter] removePendingNotificationRequestsWithIdentifiers:@[identifier]];
    [AlarmKitBridge scheduleWithId:identifier title:title body:body ?: @"" fireAt:fireDate repeatRule:repeat snoozeMinutes:10 completion:^(NSError *error) {
      if (error) { reject(@"alarm_error", error.localizedDescription, error); return; }
      resolve(nil);
    }];
    return;
  }

  [AlarmKitBridge cancelWithId:identifier];
  UNMutableNotificationContent *content = [UNMutableNotificationContent new];
  content.title = title;
  content.body = body ?: @"";
  content.sound = [UNNotificationSound defaultSound];
  content.categoryIdentifier = kCategory;
  content.userInfo = @{ @"itemId": itemId, @"alertType": alertType ?: @"notification" };
  if (@available(iOS 15.0, macOS 12.0, *)) {
    content.interruptionLevel = wantsAlarm ? UNNotificationInterruptionLevelTimeSensitive : UNNotificationInterruptionLevelActive;
  }

  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSCalendarUnit units;
  BOOL repeats = YES;
  if ([repeat isEqualToString:@"hourly"]) {
    units = NSCalendarUnitMinute | NSCalendarUnitSecond;
  } else if ([repeat isEqualToString:@"daily"]) {
    units = NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond;
  } else if ([repeat isEqualToString:@"weekly"]) {
    units = NSCalendarUnitWeekday | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond;
  } else if ([repeat isEqualToString:@"monthly"]) {
    units = NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond;
  } else if ([repeat isEqualToString:@"yearly"]) {
    units = NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond;
  } else {
    units = NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond;
    repeats = NO;
  }
  NSDateComponents *components = [calendar components:units fromDate:fireDate];
  UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components repeats:repeats];
  UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:trigger];
  [[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:request withCompletionHandler:^(NSError *error) {
    if (error) { reject(@"schedule_error", error.localizedDescription, error); return; }
    resolve(nil);
  }];
}

RCT_EXPORT_METHOD(cancel:(NSArray<NSString *> *)identifiers) {
  [[UNUserNotificationCenter currentNotificationCenter] removePendingNotificationRequestsWithIdentifiers:identifiers];
  [[UNUserNotificationCenter currentNotificationCenter] removeDeliveredNotificationsWithIdentifiers:identifiers];
  for (NSString *identifier in identifiers) {
    [AlarmKitBridge cancelWithId:identifier];
  }
}

RCT_EXPORT_METHOD(ackAction:(NSString *)eventId) {
  [[AlarmNotificationsDelegate shared] acknowledge:eventId];
}

RCT_EXPORT_METHOD(stopAlarmSound) {
  [[AlarmNotificationsDelegate shared] stopAlarmSound];
}

RCT_EXPORT_METHOD(cancelAll) {
  [[UNUserNotificationCenter currentNotificationCenter] removeAllPendingNotificationRequests];
  [AlarmKitBridge cancelAll];
}

RCT_EXPORT_METHOD(getPending:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [[UNUserNotificationCenter currentNotificationCenter] getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray *ids = [NSMutableArray new];
    for (UNNotificationRequest *request in requests) { [ids addObject:request.identifier]; }
    [ids addObjectsFromArray:[AlarmKitBridge pendingIdentifiers]];
    resolve(ids);
  }];
}

@end
