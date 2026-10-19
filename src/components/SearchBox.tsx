"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({ autoFocus = false, initial = "" }: { autoFocus?: boolean; initial?: string }) {
  const [v, setV] = useState(initial);
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) router.push(`/generate?app=${encodeURIComponent(v.trim())}`);
      }}
      className="flex gap-2 w-full max-w-xl"
    >
      <input
        autoFocus={autoFocus}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="App name or website — e.g. Zoom, calendly.com, Xero"
        className="flex-1 min-w-0 rounded-xl border border-border bg-surface px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-accent"
        aria-label="App name or website"
      />
      <button type="submit" className="rounded-xl bg-accent text-white px-5 py-3 text-sm font-medium cursor-pointer hover:opacity-90">
        Get guide
      </button>
    </form>
  );
}
