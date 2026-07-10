// hooks/support/useSupportSocket.js
//
// FIX: this hook used to OWN the entire socket connection lifecycle
// (connect, bind every event, heartbeat, disconnect on unmount) and was
// called directly inside SupportShell. Since SupportShell remounts on
// every route change in the App Router, that meant the socket connection
// was torn down and rebuilt on every single navigation inside Support
// Center — dropped typing state, reconnect churn, and unnecessary load at
// 10,000-concurrent-user scale.
//
// The connection lifecycle now lives in SupportSocketProvider
// (context/SupportSocketProvider.jsx), mounted exactly once at the app
// root (inside AuthSocketBridge, alongside the existing SocketProvider).
// This hook is now just a thin, render-safe accessor for the emit-helper
// functions — call it from as many components as you like, as often as
// you like, it never touches the connection itself.

import { useSupportSocketContext } from '../../context/SupportSocketProvider';

export function useSupportSocket() {
  return useSupportSocketContext();
}

export default useSupportSocket;
