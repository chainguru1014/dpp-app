//
//  QRAuthApp-Bridging-Header.h
//
//  This project has no Swift code yet (AppDelegate is Objective-C++/.mm), so
//  there is no bridging header to hook into. YometelRfidModule.swift is the
//  first Swift file in the app target, and needs one.
//
//  ONE-TIME MANUAL STEP (do this in Xcode, not by hand-editing project.pbxproj):
//  1. Open ios/QRAuthApp.xcodeproj in Xcode.
//  2. Drag this file plus YometelRfidModule.swift and YometelRfidModule.m
//     into the QRAuthApp group (check "QRAuthApp" target membership).
//  3. When Xcode asks "Would you like to configure an Objective-C bridging
//     header?", say Yes — or manually set Build Settings > Swift Compiler -
//     General > Objective-C Bridging Header to
//     "QRAuthApp/Rfid/QRAuthApp-Bridging-Header.h" if it doesn't ask.
//  That's it — Xcode owns project.pbxproj from there, nothing else to edit.
//
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
