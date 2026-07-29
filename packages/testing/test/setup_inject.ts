// Jest `setupFiles` entry: runs before the test framework and before any test
// module (and therefore before any SDK module) is loaded. The interface-alpha
// SDK constructs its singleton from window.__getAirtableInterfaceAtVersion at
// module-load time, so this global must exist first.
//
// For the spike this installs a minimal stand-in; the real library exports a
// dedicated `inject` entry point that installs the VacantAirtableInterface.
import '../src/inject';
