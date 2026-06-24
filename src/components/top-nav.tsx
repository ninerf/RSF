"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/auth/actions";
import type { Role } from "@/lib/types";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/searches", label: "Searches" },
  { href: "/results", label: "Results" },
  { href: "/data-sources", label: "Data Sources", adminOnly: true },
  { href: "/credentials", label: "Credentials", adminOnly: true },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/settings", label: "Settings" },
];

export function TopNav({
  username,
  role,
}: {
  username: string;
  role: Role;
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.adminOnly || role === "admin");

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Zillow Finder
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
          <span className="text-sm text-muted-foreground">
            {username}
            {role === "admin" && (
              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">
                admin
              </span>
            )}
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
