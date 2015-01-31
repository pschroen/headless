#include <v8.h>
#include <node.h>
#include <string.h>
#include <unistd.h>
#include <node_object_wrap.h>
#include <errno.h>

#include <string>

#include <sys/utsname.h>

using namespace v8;
using std::string;

Handle<Value> call_uname(const Arguments& args)
{
	HandleScope scope;
	struct utsname uts;

	(void) uname(&uts);

	Local<Object> rv = Object::New();

	rv->Set(String::New("sysname"), String::New(uts.sysname));
	rv->Set(String::New("nodename"), String::New(uts.nodename));
	rv->Set(String::New("release"), String::New(uts.release));
	rv->Set(String::New("version"), String::New(uts.version));
	rv->Set(String::New("machine"), String::New(uts.machine));

	return (rv);
}

extern "C" void
init (Handle<Object> target) 
{
	HandleScope scope;
	Local<FunctionTemplate> templ = FunctionTemplate::New(call_uname);

	target->Set(String::NewSymbol("uname"), templ->GetFunction());
}

NODE_MODULE(binding, init);