#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

@class AlarmNotifications;

@interface AlarmNotificationsDelegate : NSObject <UNUserNotificationCenterDelegate>
@property (nonatomic, weak) AlarmNotifications *module;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *pendingActions;
@property (nonatomic, strong) NSMutableDictionary<NSString *, void (^)(void)> *completionHandlers;
- (void)acknowledge:(NSString *)eventId;
+ (instancetype)shared;
@end
