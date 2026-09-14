Pod::Spec.new do |s|
  s.name         = "AlarmNotifications"
  s.version      = "1.0.0"
  s.summary      = "Native alarms and notifications for iOS and macOS"
  s.homepage     = "https://github.com/bassamsalah/reminder"
  s.license      = "MIT"
  s.author       = "Bassam Zakaria"
  s.platforms    = { :ios => "15.1", :osx => "12.0" }
  s.source       = { :git => "https://github.com/bassamsalah/reminder.git", :tag => s.version.to_s }
  s.source_files = "*.{h,m,swift}"
  s.swift_version = "5.9"
  s.static_framework = true
  s.frameworks   = "UserNotifications"
  s.ios.weak_frameworks = "AlarmKit"
  s.osx.frameworks = "AppKit"
  s.dependency "React-Core"
end
