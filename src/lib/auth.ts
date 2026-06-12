import { cookies } from "next/headers";

const ADMIN_COOKIE = "tv_admin_session";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export function getAdminPassword() {
  return ADMIN_PASSWORD;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE);
  return session?.value === "authenticated";
}

export function getAdminCookieName() {
  return ADMIN_COOKIE;
}
