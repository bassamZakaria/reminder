#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

@class AlarmNotifications;

@interface AlarmNotificationsDelegate : NSObject <UNUserNotificationCenterDelegate>
@property (nonatomic, weak) AlarmNotifications *module;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *pendingActions;
+ (instancetype)shared;
@end
