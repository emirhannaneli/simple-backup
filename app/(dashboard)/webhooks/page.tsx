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
import { WebhookForm } from "@/components/webhook-form";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function fetchWebhooks() {
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!webhookToDelete) return;

    try {
      const response = await fetch(`/api/webhooks/${webhookToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Failed to delete webhook");
        return;
      }

      toast.success("Webhook deleted");
      fetchWebhooks();
      setDeleteDialogOpen(false);
      setWebhookToDelete(null);
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
          <h1 className="text-2xl md:text-3xl font-bold">Webhooks</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage webhook notifications</p>
        </div>
        <Button
          onClick={() => {
            setSelectedWebhook(null);
            setFormOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Webhook
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No webhooks found. Create your first webhook to get started.
                </TableCell>
              </TableRow>
            ) : (
              webhooks.map((webhook) => {
                const events = Array.isArray(webhook.events)
                  ? webhook.events
                  : JSON.parse(webhook.events || "[]");
                return (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.url}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{webhook.method}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {events.map((event: string) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatRelativeTime(webhook.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 md:gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWebhook(webhook);
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
                            setWebhookToDelete(webhook.id);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <WebhookForm
        open={formOpen}
        onOpenChange={setFormOpen}
        webhook={selectedWebhook}
        onSuccess={fetchWebhooks}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the webhook.
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

