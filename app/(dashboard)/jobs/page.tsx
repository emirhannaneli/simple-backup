"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { JobForm } from "@/components/job-form";
import { Plus, Play, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(job: { id: string; isActive: boolean }) {
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...job,
          isActive: !job.isActive,
        }),
      });

      if (!response.ok) {
        toast.error("Failed to update job");
        return;
      }

      toast.success("Job updated");
      fetchJobs();
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  async function handleRunNow(jobId: string) {
    try {
      const response = await fetch(`/api/jobs/${jobId}/run`, {
        method: "POST",
      });

      if (!response.ok) {
        toast.error("Failed to start backup");
        return;
      }

      toast.success("Backup started");
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  async function handleDelete() {
    if (!jobToDelete) return;

    try {
      const response = await fetch(`/api/jobs/${jobToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Failed to delete job");
        return;
      }

      toast.success("Job deleted");
      fetchJobs();
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "RUNNING":
        return <Badge variant="secondary">Running</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Jobs</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your backup jobs</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedJob(null);
            setFormOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Job
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Datasource</TableHead>
              <TableHead>Cron Expression</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No jobs found. Create your first job to get started.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>
                    {job.datasource?.name} ({job.datasource?.type})
                  </TableCell>
                  <TableCell className="font-mono text-sm">{job.cronExpression}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={job.isActive}
                      onCheckedChange={() => handleToggleActive(job)}
                    />
                  </TableCell>
                  <TableCell>{formatRelativeTime(job.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRunNow(job.id)}
                        title="Run Now"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedJob(job);
                          setFormOpen(true);
                        }}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setJobToDelete(job.id);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <JobForm
        open={formOpen}
        onOpenChange={setFormOpen}
        job={selectedJob}
        onSuccess={fetchJobs}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job and all
              associated backups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

