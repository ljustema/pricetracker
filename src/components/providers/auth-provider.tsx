"use client"; // This must be a client component

import { SessionProvider } from "next-auth/react";
import React from "react";

// This wrapper component allows us to use SessionProvider at the root
// since SessionProvider requires the "use client" directive.
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: We don't pass the session prop here.
  // SessionProvider will automatically fetch the session on the client-side.
  // For Server Components, session can be accessed via `getServerSession(authOptions)`.
  return <SessionProvider>{children}</SessionProvider>;
}