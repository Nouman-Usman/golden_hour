import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabase-server.ts";

async function signOutTo(request: NextRequest, path: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(path, request.url), 303);
}

// The shell's Sign out button posts here.
export async function POST(request: NextRequest) {
  return signOutTo(request, "/admin/login");
}

// Only the guard's redirect for deactivated accounts may sign out via GET.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("reason") !== "deactivated") {
    return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }
  return signOutTo(request, "/admin/login?reason=deactivated");
}
