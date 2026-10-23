"use client";

import { ErrorView } from "@/components/ErrorView";

// Errors inside the signed-in shell: navigation stays visible.
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
