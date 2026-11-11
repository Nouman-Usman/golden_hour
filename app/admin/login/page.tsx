import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getStaff } from "../../lib/auth.ts";
import { adminPwaMetadata, adminViewport } from "../pwa-metadata.ts";
import { LoginForm } from "./login-form";

export const viewport = adminViewport;

export const metadata: Metadata = {
  ...adminPwaMetadata,
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
    <main className="grid min-h-svh place-items-center bg-matte px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brass font-display text-xl font-black text-matte">GH</span>
          <span className="leading-tight">
            <span className="block font-display text-2xl font-bold">Golden Hour</span>
            <span className="block text-sm text-ash">Admin</span>
          </span>
        </div>
        <div className="rounded-2xl border border-line bg-matte-2 p-5 sm:p-6">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-ash">Use the email and password the owner gave you.</p>
          <div className="mt-6">
            <Suspense fallback={<p className="text-ash">Loading…</p>}>
              <LoginContent searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
