#import "AlarmNotificationsDelegate.h"
#import "AlarmNotifications.h"
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#endif

@implementation AlarmNotificationsDelegate {
#if TARGET_OS_OSX
  NSSound *_sound;
#endif
}

+ (instancetype)shared {
  static AlarmNotificationsDelegate *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    instance = [AlarmNotificationsDelegate new];
    instance.pendingActions = [NSMutableArray new];
    instance.pendingAlarms = [NSMutableArray new];
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
  NSDictionary *info = notification.request.content.userInfo;
  if ([info[@"alertType"] isEqualToString:@"alarm"]) {
    NSDictionary *event = @{ @"itemId": info[@"itemId"] ?: @"", @"title": notification.request.content.title ?: @"", @"body": notification.request.content.body ?: @"" };
    [self startAlarmSound];
#if TARGET_OS_OSX
    [NSApp activateIgnoringOtherApps:YES];
#endif
    if (self.module) {
      [self.module emitAlarm:event];
    } else {
      [self.pendingAlarms addObject:event];
    }
    completionHandler(UNNotificationPresentationOptionList);
    return;
  }
  completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionList | UNNotificationPresentationOptionSound);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
  NSDictionary *info = response.notification.request.content.userInfo;
  NSString *itemId = info[@"itemId"] ?: response.notification.request.identifier;
  if ([response.actionIdentifier isEqualToString:UNNotificationDismissActionIdentifier]) {
    completionHandler();
    return;
  }
  if ([info[@"alertType"] isEqualToString:@"alarm"] && [response.actionIdentifier isEqualToString:UNNotificationDefaultActionIdentifier]) {
    // App was not running when the alarm-type notification fired: open it as a ringing alarm.
    NSDictionary *event = @{ @"itemId": itemId, @"title": response.notification.request.content.title ?: @"", @"body": response.notification.request.content.body ?: @"" };
    [self startAlarmSound];
    if (self.module) {
      [self.module emitAlarm:event];
    } else {
      [self.pendingAlarms addObject:event];
    }
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

- (void)startAlarmSound {
#if TARGET_OS_OSX
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self->_sound.isPlaying) {
      return;
    }
    self->_sound = [NSSound soundNamed:@"Sosumi"];
    self->_sound.loops = YES;
    self->_sound.volume = 1.0;
    [self->_sound play];
  });
#endif
}

- (void)stopAlarmSound {
#if TARGET_OS_OSX
  dispatch_async(dispatch_get_main_queue(), ^{
    [self->_sound stop];
    self->_sound = nil;
  });
#endif
}

@end
