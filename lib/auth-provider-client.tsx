"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const AuthProvider = dynamic(
  () => import("./auth-context").then((mod) => mod.AuthProvider),
  { ssr: false }
);

export default function AuthProviderClient({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
