"use client";

import { ErrorView } from "@/components/ErrorView";

// Errors on sign-in pages or in a layout itself (e.g. the database is unreachable).
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} standalone />;
}
