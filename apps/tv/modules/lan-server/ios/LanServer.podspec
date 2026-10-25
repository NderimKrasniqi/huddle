Pod::Spec.new do |s|
  s.name           = 'LanServer'
  s.version        = '0.1.0'
  s.summary        = 'Huddle TV LAN WebSocket server (TASK-03 spike).'
  s.description    = 'A WebSocket server on Network.framework for the Huddle TV app.'
  s.license        = 'UNLICENSED'
  s.author         = 'Huddle'
  s.homepage       = 'https://github.com/expo/expo'
  s.platforms      = { :ios => '16.4', :tvos => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/expo/expo.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
