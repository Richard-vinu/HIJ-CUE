"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signInAdmin } from "@/actions/cue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await signInAdmin(email.trim(), password);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Signed in");
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="relative flex min-h-[36vh] flex-col justify-between overflow-hidden bg-ink px-8 py-10 text-white md:min-h-dvh md:px-14 md:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 22%, #ffffff 0.6px, transparent 0.7px), radial-gradient(circle at 78% 68%, #ffffff 0.6px, transparent 0.7px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full border border-white/30 font-mono text-[11px]">
            HIJ
          </div>
          <div className="font-mono text-[11px] tracking-[0.18em] text-white/55 uppercase">
            Admin
          </div>
        </div>
        <div className="relative max-w-md py-8 md:py-0">
          <h1 className="text-[40px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[52px]">
            Cue
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-white/70">
            Manage tasks, people, and files for the media, worship and
            production team.
          </p>
        </div>
        <a
          href="/"
          className="relative text-[13px] text-white/45 underline underline-offset-3 hover:text-white/70"
        >
          Back to team view
        </a>
      </div>

      <div className="flex min-h-[64vh] flex-col justify-center bg-page px-6 py-10 md:min-h-dvh md:px-12 lg:px-16">
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-md md:mx-0">
          <h2 className="text-[28px] font-medium tracking-[-0.02em] text-ink md:text-[32px]">
            Sign in
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Admins only. Team members use the name picker on the home page.
          </p>

          <FieldGroup className="mt-8">
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="anish@hij.church"
                className="h-12 bg-white"
                required
              />
            </Field>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-white"
                required
              />
              {error ? (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>

          <Button type="submit" className="mt-7 h-12 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
