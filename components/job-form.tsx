"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobSchema } from "@/lib/validations";
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
import { toast } from "sonner";
import { CronHelper } from "@/components/cron-helper";
import { TIMEZONES } from "@/lib/timezones";

import type { JobWithDatasource } from "@/lib/types";

interface Datasource {
  id: string;
  name: string;
  type: string;
}

interface JobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: JobWithDatasource;
  onSuccess: () => void;
}

export function JobForm({ open, onOpenChange, job, onSuccess }: JobFormProps) {
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      datasourceId: "",
      cronExpression: "",
      destinationPath: "",
      timezone: "UTC",
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  useEffect(() => {
    if (open) {
      fetchDatasources();
      if (job) {
        reset({
          title: job.title,
          datasourceId: job.datasourceId,
          cronExpression: job.cronExpression,
          destinationPath: job.destinationPath,
          timezone: (job as any).timezone || "UTC",
          isActive: job.isActive,
        });
      } else {
        reset({
          title: "",
          datasourceId: "",
          cronExpression: "",
          destinationPath: "",
          timezone: "UTC",
          isActive: true,
        });
      }
    }
  }, [open, job, reset]);

  async function fetchDatasources() {
    try {
      const res = await fetch("/api/datasources");
      const data = await res.json();
      setDatasources(data.datasources || []);
    } catch (error) {
      console.error("Error fetching datasources:", error);
    }
  }

  const onSubmit = async (data: { title: string; datasourceId: string; cronExpression: string; destinationPath: string; timezone: string; isActive: boolean }) => {
    setLoading(true);
    try {
      const url = job ? `/api/jobs/${job.id}` : "/api/jobs";
      const method = job ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to save job");
        return;
      }

      toast.success(job ? "Job updated" : "Job created");
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
          <DialogTitle>{job ? "Edit Job" : "Create Job"}</DialogTitle>
          <DialogDescription>
            {job ? "Update the job configuration" : "Create a new backup job"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} placeholder="Daily Backup" />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="datasourceId">Datasource</Label>
            <Select
              value={watch("datasourceId")}
              onValueChange={(value) => setValue("datasourceId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select datasource" />
              </SelectTrigger>
              <SelectContent>
                {datasources.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name} ({ds.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.datasourceId && (
              <p className="text-sm text-destructive">
                {errors.datasourceId.message as string}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <CronHelper
              value={watch("cronExpression")}
              onChange={(value) => {
                setValue("cronExpression", value, { shouldValidate: true });
              }}
            />
            {errors.cronExpression && (
              <p className="text-sm text-destructive">
                {errors.cronExpression.message as string}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="destinationPath">Destination Path</Label>
            <Input
              id="destinationPath"
              {...register("destinationPath")}
              placeholder="./backups/daily"
            />
            {errors.destinationPath && (
              <p className="text-sm text-destructive">
                {errors.destinationPath.message as string}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={watch("timezone")}
              onValueChange={(value) => setValue("timezone", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timezone && (
              <p className="text-sm text-destructive">
                {errors.timezone.message as string}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The cron schedule will run according to the selected timezone.
            </p>
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
              {loading ? "Saving..." : job ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

