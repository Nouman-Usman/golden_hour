// Desktop sidebar width is remembered in a cookie so the server renders the right layout (no flash).
export const SIDEBAR_COOKIE = "gh_admin_sidebar";

export function sidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}

export function sidebarCookie(collapsed: boolean): string {
  return `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; Path=/admin; Max-Age=31536000; SameSite=Lax`;
}
