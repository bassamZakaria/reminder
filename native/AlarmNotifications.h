#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface AlarmNotifications : RCTEventEmitter <RCTBridgeModule>
- (void)emitAction:(NSDictionary *)event;
- (void)emitAlarm:(NSDictionary *)event;
@end
