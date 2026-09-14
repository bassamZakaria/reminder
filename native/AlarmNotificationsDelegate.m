#import "AlarmNotificationsDelegate.h"
#import "AlarmNotifications.h"

@implementation AlarmNotificationsDelegate

+ (instancetype)shared {
  static AlarmNotificationsDelegate *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    instance = [AlarmNotificationsDelegate new];
    instance.pendingActions = [NSMutableArray new];
    instance.completionHandlers = [NSMutableDictionary new];
  });
  return instance;
}

// Must run before the app finishes launching so action taps that launch the app are delivered.
+ (void)load {
  [UNUserNotificationCenter currentNotificationCenter].delegate = [self shared];
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
  completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionList | UNNotificationPresentationOptionSound);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
  NSString *itemId = response.notification.request.content.userInfo[@"itemId"] ?: response.notification.request.identifier;
  if ([response.actionIdentifier isEqualToString:UNNotificationDismissActionIdentifier]) {
    completionHandler();
    return;
  }
  NSString *eventId = [[NSUUID UUID] UUIDString];
  NSDictionary *event = @{ @"eventId": eventId, @"itemId": itemId, @"action": response.actionIdentifier };
  // Hold the completion handler until JS has finished the Supabase write, so iOS does not
  // suspend a background-launched app mid-request. Released by ackAction or after 25s.
  self.completionHandlers[eventId] = [completionHandler copy];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(25 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self acknowledge:eventId];
  });
  if (self.module) {
    [self.module emitAction:event];
  } else {
    [self.pendingActions addObject:event];
  }
}

- (void)acknowledge:(NSString *)eventId {
  dispatch_async(dispatch_get_main_queue(), ^{
    void (^handler)(void) = self.completionHandlers[eventId];
    if (handler) {
      [self.completionHandlers removeObjectForKey:eventId];
      handler();
    }
  });
}

@end
