Pod::Spec.new do |s|
  s.name         = "AlarmNotifications"
  s.version      = "1.0.0"
  s.summary      = "Local alarm-style notifications for iOS and macOS"
  s.homepage     = "https://github.com/bassamsalah/reminder"
  s.license      = "MIT"
  s.author       = "Bassam Zakaria"
  s.platforms    = { :ios => "15.1", :osx => "12.0" }
  s.source       = { :git => "https://github.com/bassamsalah/reminder.git", :tag => s.version.to_s }
  s.source_files = "*.{h,m}"
  s.frameworks   = "UserNotifications"
  s.dependency "React-Core"
end
