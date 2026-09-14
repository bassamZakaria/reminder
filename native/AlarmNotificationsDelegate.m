#import "AlarmNotificationsDelegate.h"
#import "AlarmNotifications.h"

@implementation AlarmNotificationsDelegate

+ (instancetype)shared {
  static AlarmNotificationsDelegate *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    instance = [AlarmNotificationsDelegate new];
    instance.pendingActions = [NSMutableArray new];
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
  NSDictionary *event = @{ @"itemId": itemId, @"action": response.actionIdentifier };
  if (self.module) {
    [self.module emitAction:event];
  } else {
    [self.pendingActions addObject:event];
  }
  completionHandler();
}

@end
