"use client";

import "./globals.css";

// Last-resort boundary: replaces the root layout, so it renders its own <html>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="page" style={{ paddingTop: 80, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "var(--text-2)", margin: "8px 0 24px" }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 50,
              padding: "0 24px",
              border: 0,
              borderRadius: 14,
              background: "var(--button-bg)",
              color: "var(--button-text)",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
