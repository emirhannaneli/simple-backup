import { SidebarProvider, SidebarInset, SidebarTrigger, SidebarRail } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { ForcePasswordChangeModal } from "@/components/force-password-change-modal";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user must change password
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  let mustChangePassword = false;
  
  if (token) {
    const payload = await verifyToken(token);
    mustChangePassword = payload?.mustChangePassword === true;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarRail />
      <SidebarInset className="flex flex-col min-h-screen">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-3 md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 hidden sm:block" />
          <div className="flex flex-1 items-center justify-between gap-2">
            <h1 className="text-base md:text-lg font-semibold truncate">Simple Backup</h1>
            <UserMenu username={user.username} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
      {mustChangePassword && (
        <ForcePasswordChangeModal userId={user.id} open={true} />
      )}
    </SidebarProvider>
  );
}

