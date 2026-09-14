#import "AlarmNotifications.h"
#import "AlarmNotificationsDelegate.h"
#import <UserNotifications/UserNotifications.h>

static NSString *const kCategory = @"RECALL_REMINDER";
NSString *const kActionComplete = @"COMPLETE";
NSString *const kActionSnooze10 = @"SNOOZE_10";
NSString *const kActionSnooze60 = @"SNOOZE_60";

@implementation AlarmNotifications {
  BOOL _observing;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents { return @[@"notificationAction"]; }

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
                                                                            options:UNNotificationCategoryOptionCustomDismissAction];
  [[UNUserNotificationCenter currentNotificationCenter] setNotificationCategories:[NSSet setWithObject:category]];
}

- (void)startObserving {
  _observing = YES;
  NSArray *pending = [[AlarmNotificationsDelegate shared].pendingActions copy];
  [[AlarmNotificationsDelegate shared].pendingActions removeAllObjects];
  for (NSDictionary *event in pending) {
    [self sendEventWithName:@"notificationAction" body:event];
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

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge;
  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:options completionHandler:^(BOOL granted, NSError *error) {
    if (error) { reject(@"permission_error", error.localizedDescription, error); return; }
    resolve(@(granted));
  }];
}

RCT_EXPORT_METHOD(schedule:(NSString *)identifier
                  itemId:(NSString *)itemId
                  title:(NSString *)title
                  body:(NSString *)body
                  fireAt:(double)fireAtMs
                  repeat:(NSString *)repeat
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  UNMutableNotificationContent *content = [UNMutableNotificationContent new];
  content.title = title;
  content.body = body ?: @"";
  content.sound = [UNNotificationSound defaultSound];
  content.categoryIdentifier = kCategory;
  content.userInfo = @{ @"itemId": itemId };
  if (@available(iOS 15.0, macOS 12.0, *)) {
    content.interruptionLevel = UNNotificationInterruptionLevelTimeSensitive;
  }

  NSDate *fireDate = [NSDate dateWithTimeIntervalSince1970:fireAtMs / 1000.0];
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
}

RCT_EXPORT_METHOD(cancelAll) {
  [[UNUserNotificationCenter currentNotificationCenter] removeAllPendingNotificationRequests];
}

RCT_EXPORT_METHOD(getPending:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [[UNUserNotificationCenter currentNotificationCenter] getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray *ids = [NSMutableArray new];
    for (UNNotificationRequest *request in requests) { [ids addObject:request.identifier]; }
    resolve(ids);
  }];
}

@end
