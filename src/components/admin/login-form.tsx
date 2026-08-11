"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { signInAdmin } from "@/actions/cue";
import { HijBrandLockup } from "@/components/brand/hij-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim();
    if (!cleanEmail.includes("@")) {
      setError("Enter a valid admin email.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    startTransition(async () => {
      const res = await signInAdmin(cleanEmail, password);
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
    <div className="glass-ambient relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-36 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(255,255,255,0)_70%)] blur-[40px] dark:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-10 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(90,97,114,0.35),rgba(90,97,114,0)_70%)] blur-[50px] dark:opacity-40"
      />

      <div className="absolute top-4 right-4 z-20 md:top-6 md:right-6">
        <ThemeToggle />
      </div>

      <form
        onSubmit={onSubmit}
        className="glass-panel relative z-10 w-full max-w-md px-6 py-8 md:px-8"
      >
        <HijBrandLockup
          className="mb-6"
          markSize={44}
          subtitle="Admin"
          priority
        />

        <h1 className="text-[28px] font-medium tracking-[-0.02em] text-ink">
          Sign in
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">
          Admins only. Team members use the name picker on the home page.
        </p>

        <FieldGroup className="mt-7">
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="glass-surface h-12 border-white/80 dark:border-white/10"
              required
            />
          </Field>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-surface h-12 border-white/80 pr-11 dark:border-white/10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-2 transition-colors hover:bg-ink/8 hover:text-ink"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" strokeWidth={1.75} />
                ) : (
                  <EyeIcon className="size-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
            {error ? (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          className="mt-7 h-12 w-full rounded-[14px] shadow-[0_6px_16px_rgba(16,23,41,0.2)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>

        <Link
          href="/"
          className="mt-4 block text-center text-[13px] text-ink-2 underline underline-offset-3 hover:text-ink"
        >
          Back to team view
        </Link>
      </form>
    </div>
  );
}
