"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Min 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <>
      <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
        Sign in
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Welcome back. Continue to your arena.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit(async () => {
          await new Promise((r) => setTimeout(r, 800));
        })}
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-ink-dim">
            Email
          </label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@arena.gg"
              className="pl-9"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-neon-red">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink-dim">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-ink-muted hover:text-neon-electric"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <Input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pl-9 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-neon-red">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[10.5px] uppercase tracking-widest text-ink-dim">
        <span className="h-px flex-1 bg-white/10" />
        or continue with
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-sm text-ink-muted">
        New to Esports Arena?{" "}
        <Link
          href="/signup"
          className="font-semibold text-neon-electric hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
