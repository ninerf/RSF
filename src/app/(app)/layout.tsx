import { requireProfile } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav username={profile.username} role={profile.role} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
