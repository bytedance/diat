#include <sstream>
#include <uv.h>

#include "linux-perf.h"

namespace node {

LinuxPerfHandler::LinuxPerfHandler(v8::Isolate* isolate) : v8::CodeEventHandler(isolate) {
  // TODO(mmarchini):: ideally this should be handled in another thread.
  auto pid = static_cast<int>(uv_os_getpid());

  mapFile.open("/tmp/perf-" + std::to_string(pid) + ".map");
}

LinuxPerfHandler::~LinuxPerfHandler() {
  mapFile.close();
}

std::string LinuxPerfHandler::FormatName(v8::CodeEvent* code_event) {
  auto comment = std::string(code_event->GetComment());
  if (not comment.empty()) return comment;

  char buffer[1000];
  std::ostringstream formattedName;

  v8::Isolate* isolate = v8::Isolate::GetCurrent();

  auto functionName = code_event->GetFunctionName();
  functionName->WriteUtf8(isolate, buffer, 1000);
  formattedName << buffer;

  auto scriptName = code_event->GetScriptName();
  scriptName->WriteUtf8(isolate, buffer, 1000);
  if(buffer[0] != '\0') {
    formattedName << " " << buffer << ":" << code_event->GetScriptLine();
  }

  return formattedName.str();
}

void LinuxPerfHandler::Handle(v8::CodeEvent* code_event) {
  mapFile << std::hex << code_event->GetCodeStartAddress() << " "
          << std::hex << code_event->GetCodeSize() << " "
          << v8::CodeEvent::GetCodeEventTypeName(code_event->GetCodeType())
          << ":" << FormatName(code_event) << std::endl;
}

}
