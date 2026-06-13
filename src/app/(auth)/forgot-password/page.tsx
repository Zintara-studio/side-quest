"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <>
      <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
        Reset password
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        We'll send you a magic link to set a new password.
      </p>

      {isSubmitSuccessful ? (
        <div className="mt-7 rounded-xl border border-neon-lime/30 bg-neon-lime/10 p-4 text-sm text-neon-lime">
          Check your inbox — the link is on its way.
        </div>
      ) : (
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
                placeholder="you@arena.gg"
                className="pl-9"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-neon-red">
                {errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-neon-electric hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
