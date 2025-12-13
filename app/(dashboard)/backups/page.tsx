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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";

export default function BackupsPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<any>(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  async function fetchBackups() {
    try {
      const res = await fetch("/api/backups");
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (error) {
      console.error("Error fetching backups:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(backupId: string, filename: string) {
    try {
      const response = await fetch(`/api/backups/${backupId}/download`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to download backup");
        return;
      }

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let downloadFilename = filename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      toast.success("Download started");
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error(error.message || "An error occurred while downloading");
    }
  }

  async function handleDelete() {
    if (!backupToDelete) return;

    try {
      const response = await fetch(`/api/backups/${backupToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Failed to delete backup");
        return;
      }

      toast.success("Backup deleted");
      fetchBackups();
      setDeleteDialogOpen(false);
      setBackupToDelete(null);
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "SUCCESS":
        return <Badge variant="default">Success</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Backups</h1>
        <p className="text-sm md:text-base text-muted-foreground">View and manage your backup files</p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No backups found.
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-medium">{backup.filename}</TableCell>
                  <TableCell>{backup.job?.title || "Unknown"}</TableCell>
                  <TableCell>{formatDate(backup.createdAt)}</TableCell>
                  <TableCell>{formatBytes(backup.size)}</TableCell>
                  <TableCell>{getStatusBadge(backup.status)}</TableCell>
                  <TableCell>{formatDuration(backup.durationMs)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 md:gap-2">
                      {backup.status === "SUCCESS" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(backup.id, backup.filename)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {backup.status === "FAILED" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setErrorDialogOpen(true);
                          }}
                          title="View Error"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setBackupToDelete(backup.id);
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the backup file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Backup Error</DialogTitle>
            <DialogDescription>
              Error details for backup: {selectedBackup?.filename}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex-1 overflow-hidden">
            <pre className="rounded-md bg-muted p-3 md:p-4 text-xs md:text-sm overflow-auto max-h-[60vh] break-words whitespace-pre-wrap break-all">
              {selectedBackup?.errorMessage || "No error message available"}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

