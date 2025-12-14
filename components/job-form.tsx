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
import { Checkbox } from "@/components/ui/checkbox";
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
      datasourceIds: [] as string[],
      cronExpression: "",
      destinationPath: "",
      timezone: "UTC",
      isActive: true,
    },
  });

  const isActive = watch("isActive");
  const datasourceIds = watch("datasourceIds") || [];

  useEffect(() => {
    if (open) {
      fetchDatasources();
      if (job) {
        // Get datasourceIds from job (could be from datasources array or datasourceIds field)
        const jobDatasourceIds = (job as any).datasourceIds || 
          ((job as any).datasources?.map((jd: any) => jd.datasourceId) || []);
        
        reset({
          title: job.title,
          datasourceIds: jobDatasourceIds,
          cronExpression: job.cronExpression,
          destinationPath: job.destinationPath,
          timezone: (job as any).timezone || "UTC",
          isActive: job.isActive,
        });
      } else {
        reset({
          title: "",
          datasourceIds: [],
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

  const onSubmit = async (data: { title: string; datasourceIds: string[]; cronExpression: string; destinationPath: string; timezone: string; isActive: boolean }) => {
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
            <Label>Datasources</Label>
            <div className="space-y-2 border rounded-md p-3 max-h-[200px] overflow-y-auto">
              {datasources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No datasources available. Create a datasource first.</p>
              ) : (
                datasources.map((ds) => (
                  <div key={ds.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`datasource-${ds.id}`}
                      checked={datasourceIds.includes(ds.id)}
                      onCheckedChange={(checked) => {
                        const currentIds = datasourceIds || [];
                        if (checked) {
                          setValue("datasourceIds", [...currentIds, ds.id], { shouldValidate: true });
                        } else {
                          setValue("datasourceIds", currentIds.filter(id => id !== ds.id), { shouldValidate: true });
                        }
                      }}
                    />
                    <Label htmlFor={`datasource-${ds.id}`} className="font-normal cursor-pointer">
                      {ds.name} ({ds.type})
                    </Label>
                  </div>
                ))
              )}
            </div>
            {errors.datasourceIds && (
              <p className="text-sm text-destructive">
                {errors.datasourceIds.message as string}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Select one or more datasources to backup in this job.
            </p>
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

