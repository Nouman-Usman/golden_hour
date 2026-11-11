import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getStaff } from "../../lib/auth.ts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Golden Hour Admin",
  robots: { index: false, follow: false },
};

// Cookies/searchParams are runtime data: under Cache Components they must be read inside <Suspense>.
async function LoginContent({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  await connection();
  const staff = await getStaff();
  if (staff?.active) redirect("/admin");
  const { reason } = await searchParams;
  return <LoginForm notice={reason === "deactivated" ? "This account is deactivated." : undefined} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-4 py-16">
      <p className="brass font-display text-5xl font-black uppercase leading-none">Golden Hour</p>
      <h1 className="mt-2 text-lg text-bone/75">Admin sign in</h1>
      <div className="mt-10">
        <Suspense fallback={<p className="text-ash">Loading…</p>}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
