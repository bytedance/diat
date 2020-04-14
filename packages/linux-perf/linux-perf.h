#ifndef __LINUX_PERF_H
#define __LINUX_PERF_H

#include "v8-profiler.h"
#include <napi.h>
#include <fstream>


namespace node {

class LinuxPerfHandler : public v8::CodeEventHandler {
 public:
  explicit LinuxPerfHandler(v8::Isolate* isolate);
  ~LinuxPerfHandler() override;


  void Handle(v8::CodeEvent* code_event) override;
 private:
  std::ofstream mapFile;
  std::string FormatName(v8::CodeEvent* code_event);
};

class LinuxPerf : public Napi::ObjectWrap<LinuxPerf> {
 public:
  explicit LinuxPerf(const Napi::CallbackInfo& info);

  static void Initialize(Napi::Env env, Napi::Object exports);

  Napi::Value Start(const Napi::CallbackInfo& info);
  Napi::Value Stop(const Napi::CallbackInfo& info);

  LinuxPerfHandler* handler;
};

};

#endif  // __LINUX_PERF_H
