#include <napi.h>
#include <v8.h>

#include "linux-perf.h"

namespace node {

void LinuxPerf::Initialize(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "LinuxPerf", {
    InstanceMethod("start", &LinuxPerf::Start),
    InstanceMethod("stop", &LinuxPerf::Stop)
  });

  exports.Set("LinuxPerf", func);
}

LinuxPerf::LinuxPerf(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LinuxPerf>(info){
  handler = nullptr;
}

Napi::Value LinuxPerf::Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (handler == nullptr) {
    handler = new LinuxPerfHandler(v8::Isolate::GetCurrent());
    handler->Enable();
    return Napi::Boolean::New(env, true);
  }
  return Napi::Boolean::New(env, false);
}

Napi::Value LinuxPerf::Stop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (handler != nullptr) {
    handler->Disable();
    delete handler;
    handler = nullptr;
    return Napi::Boolean::New(env, true);
  }
  return Napi::Boolean::New(env, false);
}

Napi::Object init(Napi::Env env, Napi::Object exports) {
  LinuxPerf::Initialize(env, exports);
  return exports;
}

NODE_API_MODULE(LiuxPerfBindings, init)

};
