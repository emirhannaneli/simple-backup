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
import { DatasourceForm } from "@/components/datasource-form";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";

export default function DatasourcesPage() {
  const [datasources, setDatasources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDatasource, setSelectedDatasource] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [datasourceToDelete, setDatasourceToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchDatasources();
  }, []);

  async function fetchDatasources() {
    try {
      const res = await fetch("/api/datasources");
      const data = await res.json();
      setDatasources(data.datasources || []);
    } catch (error) {
      console.error("Error fetching datasources:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!datasourceToDelete) return;

    try {
      const response = await fetch(`/api/datasources/${datasourceToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to delete datasource");
        return;
      }

      toast.success("Datasource deleted");
      fetchDatasources();
      setDeleteDialogOpen(false);
      setDatasourceToDelete(null);
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  function getTypeBadge(type: string) {
    return <Badge variant="outline">{type}</Badge>;
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Datasources</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your database connections</p>
        </div>
        <Button
          onClick={() => {
            setSelectedDatasource(null);
            setFormOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Datasource
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Database</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datasources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No datasources found. Create your first datasource to get started.
                </TableCell>
              </TableRow>
            ) : (
              datasources.map((datasource) => (
                <TableRow key={datasource.id}>
                  <TableCell className="font-medium">{datasource.name}</TableCell>
                  <TableCell>{getTypeBadge(datasource.type)}</TableCell>
                  <TableCell>{datasource.host}</TableCell>
                  <TableCell>{datasource.port}</TableCell>
                  <TableCell>{datasource.databaseName}</TableCell>
                  <TableCell>{datasource._count?.jobs || 0}</TableCell>
                  <TableCell>{formatRelativeTime(datasource.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDatasource(datasource);
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
                          setDatasourceToDelete(datasource.id);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete"
                        disabled={(datasource._count?.jobs || 0) > 0}
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

      <DatasourceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        datasource={selectedDatasource}
        onSuccess={fetchDatasources}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the datasource.
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

