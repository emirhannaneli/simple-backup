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
import { ApiKeyForm } from "@/components/api-key-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  async function fetchApiKeys() {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!keyToDelete) return;

    try {
      const response = await fetch(`/api/api-keys/${keyToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Failed to delete API key");
        return;
      }

      toast.success("API key deleted");
      fetchApiKeys();
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">API Keys</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage API keys for external access</p>
        </div>
        <Button 
          onClick={() => setFormOpen(true)}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No API keys found. Create your first API key to get started.
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">{key.prefix}</TableCell>
                  <TableCell>
                    {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell>{formatRelativeTime(key.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setKeyToDelete(key.id);
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ApiKeyForm open={formOpen} onOpenChange={setFormOpen} onSuccess={fetchApiKeys} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the API key.
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

