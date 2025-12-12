"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { webhookSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import type { WebhookWithEvents } from "@/lib/types";

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: WebhookWithEvents;
  onSuccess: () => void;
}

export function WebhookForm({ open, onOpenChange, webhook, onSuccess }: WebhookFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      url: "",
      method: "POST" as const,
      events: [] as ("JOB_SUCCESS" | "JOB_FAILURE")[],
      isActive: true,
    },
  });

  const isActive = watch("isActive");
  const events = watch("events");

  useEffect(() => {
    if (open) {
      if (webhook) {
        let parsedEvents: ("JOB_SUCCESS" | "JOB_FAILURE")[];
        if (Array.isArray(webhook.events)) {
          parsedEvents = webhook.events.filter((e): e is "JOB_SUCCESS" | "JOB_FAILURE" => 
            e === "JOB_SUCCESS" || e === "JOB_FAILURE"
          );
        } else {
          const parsed = JSON.parse(webhook.events || "[]") as string[];
          parsedEvents = parsed.filter((e): e is "JOB_SUCCESS" | "JOB_FAILURE" => 
            e === "JOB_SUCCESS" || e === "JOB_FAILURE"
          );
        }
        reset({
          url: webhook.url,
          method: webhook.method as "GET" | "POST" | "PUT" | "PATCH",
          events: parsedEvents,
          isActive: webhook.isActive,
        });
      } else {
        reset({
          url: "",
          method: "POST",
          events: [],
          isActive: true,
        });
      }
    }
  }, [open, webhook, reset]);

  function toggleEvent(event: "JOB_SUCCESS" | "JOB_FAILURE") {
    const currentEvents = events || [];
    if (currentEvents.includes(event)) {
      setValue(
        "events",
        currentEvents.filter((e) => e !== event)
      );
    } else {
      setValue("events", [...currentEvents, event]);
    }
  }

  const onSubmit = async (data: { url: string; method: "GET" | "POST" | "PUT" | "PATCH"; events: ("JOB_SUCCESS" | "JOB_FAILURE")[]; isActive: boolean }) => {
    setLoading(true);
    try {
      const url = webhook ? `/api/webhooks/${webhook.id}` : "/api/webhooks";
      const method = webhook ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to save webhook");
        return;
      }

      toast.success(webhook ? "Webhook updated" : "Webhook created");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{webhook ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
          <DialogDescription>
            {webhook ? "Update the webhook configuration" : "Add a new webhook endpoint"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              {...register("url")}
              placeholder="https://example.com/webhook"
            />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <Select
              value={watch("method")}
              onValueChange={(value: any) => setValue("method", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="event-success"
                  checked={events?.includes("JOB_SUCCESS")}
                  onCheckedChange={() => toggleEvent("JOB_SUCCESS")}
                />
                <Label htmlFor="event-success" className="font-normal">
                  Job Success
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="event-failure"
                  checked={events?.includes("JOB_FAILURE")}
                  onCheckedChange={() => toggleEvent("JOB_FAILURE")}
                />
                <Label htmlFor="event-failure" className="font-normal">
                  Job Failure
                </Label>
              </div>
            </div>
            {errors.events && (
              <p className="text-sm text-destructive">{errors.events.message as string}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : webhook ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

