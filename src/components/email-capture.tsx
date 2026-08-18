"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailCapture() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        // TODO(phase 3): POST to /api/subscribe backed by Resend (RESEND_API_KEY).
        // For now this is a client-side stub — no data leaves the browser.
        setDone(true);
      }}
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Email address"
      />
      <Button type="submit" className="shrink-0">
        {done ? "Thanks!" : "Subscribe"}
      </Button>
      {done ? (
        <p className="sr-only" role="status">
          Subscription stub — email capture is not wired up yet.
        </p>
      ) : null}
    </form>
  );
}
