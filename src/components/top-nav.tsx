"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/auth/actions";
import type { Role } from "@/lib/types";

// roles undefined => visible to everyone.
type NavItem = { href: string; label: string; roles?: Role[] };

const STAFF: Role[] = ["admin", "worker"];

const NAV: NavItem[] = [
  { href: "/searches", label: "Searches", roles: STAFF },
  { href: "/results", label: "Results", roles: STAFF },
  { href: "/deals", label: "Deals" },
  { href: "/guide", label: "Guide" },
  { href: "/data-sources", label: "Data Sources", roles: ["admin"] },
  { href: "/credentials", label: "Credentials", roles: ["admin"] },
  { href: "/users", label: "Users", roles: ["admin"] },
  { href: "/settings", label: "Settings" },
];

export function TopNav({
  username,
  role,
  unreadCount = 0,
}: {
  username: string;
  role: Role;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/searches" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Zillow Finder" className="h-8" />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/notifications"
            className="relative rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            title="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <span className="text-sm text-muted-foreground">
            {username}
            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">
              {role}
            </span>
          </span>
          <form action={logout}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
