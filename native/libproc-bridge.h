// libproc-bridge.h
// Bridging header for libproc (fast CWD detection via proc_pidinfo)
// This header exposes libproc C functions to Swift for 10-50x faster
// process CWD detection compared to lsof command.

#ifndef libproc_bridge_h
#define libproc_bridge_h

#include <libproc.h>
#include <sys/proc_info.h>

#endif /* libproc_bridge_h */
