"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Eye, EyeOff, Mail, Lock, User, Trophy, Users, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  handle: z.string().min(3, "Min 3 characters").max(20, "Max 20"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Min 8 characters")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[0-9]/, "Add a number"),
});
type FormValues = z.infer<typeof schema>;

const roles = [
  { id: "fan", label: "Fan", icon: Users, desc: "Follow players & leagues" },
  { id: "player", label: "Player", icon: Trophy, desc: "Compete & rank up" },
  { id: "owner", label: "Owner", icon: Gavel, desc: "Run a franchise" },
];

export default function SignupPage() {
  const [role, setRole] = useState("fan");
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const pw = watch("password") ?? "";
  const strength = Math.min(
    100,
    (pw.length >= 8 ? 35 : pw.length * 4) +
      (/[A-Z]/.test(pw) ? 25 : 0) +
      (/[0-9]/.test(pw) ? 20 : 0) +
      (/[^A-Za-z0-9]/.test(pw) ? 20 : 0),
  );

  return (
    <>
      <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
        Create your account
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Pick how you'll use Esports Arena — you can change this later.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRole(r.id)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              role === r.id
                ? "border-neon-electric/50 bg-neon-electric/10 shadow-neon"
                : "border-white/10 bg-white/[0.02] hover:border-white/20",
            )}
          >
            <r.icon
              className={cn(
                "h-4 w-4",
                role === r.id ? "text-neon-electric" : "text-ink-muted",
              )}
            />
            <p className="mt-2 text-sm font-semibold text-ink">{r.label}</p>
            <p className="text-[10.5px] text-ink-dim">{r.desc}</p>
          </button>
        ))}
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit(async () => {
          await new Promise((r) => setTimeout(r, 800));
        })}
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-ink-dim">
            Handle
          </label>
          <div className="relative mt-1.5">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <Input
              placeholder="your-handle"
              className="pl-9"
              {...register("handle")}
            />
          </div>
          {errors.handle && (
            <p className="mt-1 text-xs text-neon-red">{errors.handle.message}</p>
          )}
        </div>

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
          <label className="block text-xs font-semibold uppercase tracking-widest text-ink-dim">
            Password
          </label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <Input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
          {pw.length > 0 && (
            <div className="mt-2">
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    "h-full transition-all",
                    strength < 40
                      ? "bg-neon-red"
                      : strength < 70
                        ? "bg-neon-amber"
                        : "bg-neon-lime",
                  )}
                  style={{ width: `${strength}%` }}
                />
              </div>
              <p className="mt-1 text-[10.5px] text-ink-dim">
                Password strength · {strength < 40 ? "weak" : strength < 70 ? "ok" : "strong"}
              </p>
            </div>
          )}
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[10.5px] uppercase tracking-widest text-ink-dim">
        <span className="h-px flex-1 bg-white/10" />
        or sign up with
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-neon-electric hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
