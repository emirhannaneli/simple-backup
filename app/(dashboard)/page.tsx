"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Clock, HardDrive, CheckCircle2 } from "lucide-react";

interface Stats {
  totalJobs: number;
  activeJobs: number;
  totalBackups: number;
  successfulBackups: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalJobs: 0,
    activeJobs: 0,
    totalBackups: 0,
    successfulBackups: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [jobsRes, backupsRes] = await Promise.all([
          fetch("/api/jobs"),
          fetch("/api/backups"),
        ]);

        const jobsData = await jobsRes.json();
        const backupsData = await backupsRes.json();

        const totalJobs = jobsData.jobs?.length || 0;
        const activeJobs = jobsData.jobs?.filter((j: { isActive: boolean }) => j.isActive).length || 0;
        const totalBackups = backupsData.backups?.length || 0;
        const successfulBackups =
          backupsData.backups?.filter((b: { status: string }) => b.status === "SUCCESS").length || 0;

        setStats({
          totalJobs,
          activeJobs,
          totalBackups,
          successfulBackups,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">Overview of your backup system</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
            <CardDescription>{stats.activeJobs} active</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <CardDescription>Currently scheduled</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBackups}</div>
            <CardDescription>All time</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalBackups > 0
                ? Math.round((stats.successfulBackups / stats.totalBackups) * 100)
                : 0}
              %
            </div>
            <CardDescription>
              {stats.successfulBackups} of {stats.totalBackups} successful
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

