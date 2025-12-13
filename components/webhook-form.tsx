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
import { Plus, X } from "lucide-react";

import type { WebhookWithEvents } from "@/lib/types";

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: WebhookWithEvents;
  onSuccess: () => void;
}

interface HeaderPair {
  key: string;
  value: string;
}

export function WebhookForm({ open, onOpenChange, webhook, onSuccess }: WebhookFormProps) {
  const [loading, setLoading] = useState(false);
  const [headerPairs, setHeaderPairs] = useState<HeaderPair[]>([]);

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
      headers: {} as Record<string, string>,
      isActive: true,
    },
  });

  const isActive = watch("isActive");
  const events = watch("events");
  const headers = watch("headers") || {};

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
        
        let parsedHeaders: Record<string, string> = {};
        if (webhook.headers) {
          if (typeof webhook.headers === "object") {
            parsedHeaders = webhook.headers;
          } else {
            try {
              parsedHeaders = JSON.parse(webhook.headers);
            } catch {
              parsedHeaders = {};
            }
          }
        }
        
        // Convert headers object to array of pairs
        const pairs: HeaderPair[] = Object.entries(parsedHeaders).map(([key, value]) => ({
          key,
          value,
        }));
        setHeaderPairs(pairs.length > 0 ? pairs : [{ key: "", value: "" }]);
        
        reset({
          url: webhook.url,
          method: webhook.method as "GET" | "POST" | "PUT" | "PATCH",
          events: parsedEvents,
          headers: parsedHeaders,
          isActive: webhook.isActive,
        });
      } else {
        setHeaderPairs([{ key: "", value: "" }]);
        reset({
          url: "",
          method: "POST",
          events: [],
          headers: {},
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

  // Convert header pairs to object and update form
  useEffect(() => {
    const headersObj: Record<string, string> = {};
    headerPairs.forEach((pair) => {
      if (pair.key.trim()) {
        headersObj[pair.key.trim()] = pair.value;
      }
    });
    setValue("headers", headersObj);
  }, [headerPairs, setValue]);

  function addHeaderPair() {
    setHeaderPairs([...headerPairs, { key: "", value: "" }]);
  }

  function removeHeaderPair(index: number) {
    const newPairs = headerPairs.filter((_, i) => i !== index);
    setHeaderPairs(newPairs.length > 0 ? newPairs : [{ key: "", value: "" }]);
  }

  function updateHeaderPair(index: number, field: "key" | "value", value: string) {
    const newPairs = [...headerPairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setHeaderPairs(newPairs);
  }

  const onSubmit = async (data: { url: string; method: "GET" | "POST" | "PUT" | "PATCH"; events: ("JOB_SUCCESS" | "JOB_FAILURE")[]; headers?: Record<string, string>; isActive: boolean }) => {
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Headers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHeaderPair}
                className="h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Header
              </Button>
            </div>
            <div className="space-y-2">
              {headerPairs.map((pair, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Header name (e.g., Authorization)"
                      value={pair.key}
                      onChange={(e) => updateHeaderPair(index, "key", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder='Value (e.g., Bearer ${WEBHOOK_TOKEN})'
                      value={pair.value}
                      onChange={(e) => updateHeaderPair(index, "value", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeaderPair(index)}
                    className="h-9 w-9 shrink-0"
                    disabled={headerPairs.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional: Add custom headers. Use <code className="bg-muted px-1 rounded">${`{ENV_VAR}`}</code> or <code className="bg-muted px-1 rounded">$ENV_VAR</code> to reference environment variables.
            </p>
            {errors.headers && (
              <p className="text-sm text-destructive">
                {typeof errors.headers.message === "string" ? errors.headers.message : "Invalid headers format"}
              </p>
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

