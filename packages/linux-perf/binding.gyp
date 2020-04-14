{
  "targets": [
    {
      "target_name": "linux-perf",
      "sources": [
        "linux-perf.cc",
        "linux-perf-listener.cc",
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
    }
  ]
}
