//
//  YometelRfidModule.m
//  QRAuthApp
//
//  Objective-C bridge that exposes YometelRfidModule.swift's @objc methods to
//  the classic RN bridge (RCT_EXTERN_MODULE) — this app has no TurboModule/
//  Codegen setup (see the Android module's equivalent, plain
//  ReactContextBaseJavaModule + ReactPackage), so this is the right pattern
//  here rather than a Codegen spec.
//
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(YometelRfidModule, RCTEventEmitter)

RCT_EXTERN_METHOD(connect:(NSString *)macAddress
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(disconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(sendCommand:(NSString *)command
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
