"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Clock,
  HardDrive,
  Key,
  Webhook,
  Users,
  BookOpen,
  Globe,
  Github,
  UserCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navigation = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Jobs",
    url: "/jobs",
    icon: Clock,
  },
  {
    title: "Backups",
    url: "/backups",
    icon: HardDrive,
  },
  {
    title: "Datasources",
    url: "/datasources",
    icon: Database,
  },
  {
    title: "API Keys",
    url: "/api-keys",
    icon: Key,
  },
  {
    title: "Webhooks",
    url: "/webhooks",
    icon: Webhook,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
  {
    title: "API Docs",
    url: "/api-docs",
    icon: BookOpen,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader>
        <div className="flex flex-col items-center gap-3 px-2 py-4">
          <Image
            src="/logo.png"
            alt="Simple Backup Logo"
            width={80}
            height={80}
            className="rounded"
            priority
          />
          <h2 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-story-script)' }}>
            Simple Backup
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-center gap-4 px-2 py-4">
          <a
            href="https://emirman.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent transition-colors"
            aria-label="Visit website"
          >
            <Globe className="h-5 w-5" />
          </a>
          <a
            href="https://github.com/emirhannaneli/simple-backup"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent transition-colors"
            aria-label="View on GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

