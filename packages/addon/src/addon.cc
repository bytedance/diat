#include <napi.h>
#include <node.h>
#include <uv.h>
#include <cstdio>

static bool callback_added = 0;
static size_t NearHeapLimitCallback(void* data,
                                    size_t current_heap_limit,
                                    size_t initial_heap_limit) {
  return initial_heap_limit * 2;
}

#if NODE_MAJOR_VERSION >= 10
Napi::Value AddIncreaseHeapLimitHandler(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (callback_added) {
    return Napi::Boolean::New(env, 0);
  }
  callback_added = 1;
  v8::Isolate *isolate = v8::Isolate::GetCurrent();
  // https://v8docs.nodesource.com/node-10.15/d5/dda/classv8_1_1_isolate.html#ad48e4a0b67b9fb6be0187985d57d9aa2
  isolate->AddNearHeapLimitCallback(NearHeapLimitCallback, nullptr);
  return Napi::Boolean::New(env, 1);
}

Napi::Value RemoveIncreaseHeapLimitHandler(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (!callback_added) {
    return Napi::Boolean::New(env, 0);
  }
  callback_added = 0;
  v8::Isolate *isolate = v8::Isolate::GetCurrent();
  // https://v8docs.nodesource.com/node-10.15/d5/dda/classv8_1_1_isolate.html#a8c570a717d0154b1aac2f1731fd92fa2
  isolate->RemoveNearHeapLimitCallback(NearHeapLimitCallback, 0);
  return Napi::Boolean::New(env, 1);
}
#endif

Napi::Object InitModulde(Napi::Env env, Napi::Object exports) {
#if NODE_MAJOR_VERSION >= 10
  exports.Set(Napi::String::New(env, "addIncreaseHeapLimitHandler"),
              Napi::Function::New(env, AddIncreaseHeapLimitHandler));
  exports.Set(Napi::String::New(env, "removeIncreaseHeapLimitHandler"),
              Napi::Function::New(env, RemoveIncreaseHeapLimitHandler));
#endif
  return exports;
}

NODE_API_MODULE(addon, InitModulde);
