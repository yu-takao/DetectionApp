"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ color: "#dc2626", fontSize: "1.25rem" }}>エラーが発生しました</h1>
      <pre
        style={{
          background: "#fee2e2",
          padding: "1rem",
          borderRadius: 8,
          fontSize: "0.85rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {error.message}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          background: "#18181b",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        再試行
      </button>
    </div>
  );
}
