#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

@class AlarmNotifications;

@interface AlarmNotificationsDelegate : NSObject <UNUserNotificationCenterDelegate>
@property (nonatomic, weak) AlarmNotifications *module;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *pendingActions;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *pendingAlarms;
@property (nonatomic, strong) NSMutableDictionary<NSString *, void (^)(void)> *completionHandlers;
+ (instancetype)shared;
- (void)acknowledge:(NSString *)eventId;
- (void)startAlarmSound;
- (void)stopAlarmSound;
@end
