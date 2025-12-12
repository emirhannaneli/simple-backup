"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { datasourceSchema } from "@/lib/validations";
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
import { toast } from "sonner";

import type { DatasourceWithCount } from "@/lib/types";

interface DatasourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasource?: DatasourceWithCount;
  onSuccess: () => void;
}

export function DatasourceForm({
  open,
  onOpenChange,
  datasource,
  onSuccess,
}: DatasourceFormProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(datasourceSchema),
    defaultValues: {
      name: "",
      type: "MYSQL" as const,
      host: "",
      port: 3306,
      username: "",
      password: "",
      databaseName: "",
    },
  });

  const dbType = watch("type");

  useEffect(() => {
    if (open) {
      if (datasource) {
        reset({
          name: datasource.name,
          type: datasource.type as "MYSQL" | "POSTGRES" | "MONGODB",
          host: datasource.host,
          port: datasource.port,
          username: datasource.username,
          password: "", // Don't pre-fill password
          databaseName: datasource.databaseName,
        });
      } else {
        reset({
          name: "",
          type: "MYSQL",
          host: "",
          port: 3306,
          username: "",
          password: "",
          databaseName: "",
        });
      }
    }
  }, [open, datasource, reset]);

  useEffect(() => {
    // Set default port based on type
    if (dbType === "MYSQL") {
      setValue("port", 3306);
    } else if (dbType === "POSTGRES") {
      setValue("port", 5432);
    } else if (dbType === "MONGODB") {
      setValue("port", 27017);
    }
  }, [dbType, setValue]);

  async function handleTest() {
    const formData = watch();
    setTesting(true);
    try {
      let datasourceId = datasource?.id;

      // If creating new datasource, save it first
      if (!datasourceId) {
        const createRes = await fetch("/api/datasources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!createRes.ok) {
          const error = await createRes.json();
          toast.error(error.error || "Failed to create datasource for testing");
          setTesting(false);
          return;
        }

        const created = await createRes.json();
        datasourceId = created.datasource.id;
      } else if (datasource) {
        // Update existing datasource first
        const updateRes = await fetch(`/api/datasources/${datasource.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!updateRes.ok) {
          toast.error("Failed to update datasource");
          setTesting(false);
          return;
        }
      }

      // Now test the connection
      const testRes = await fetch(`/api/datasources/${datasourceId}/test`, {
        method: "POST",
      });

      const result = await testRes.json();

      if (result.success) {
        // Parse multi-line success message
        const message = result.message || "Connection successful!";
        const lines = message.split("\n").filter(line => line.trim());
        const title = lines[0] || "Connection Successful";
        const description = lines.slice(1).join("\n") || "Database connection verified.";
        
        toast.success(title, {
          description: description,
          duration: 6000,
        });
      } else {
        // Parse multi-line error message
        const error = result.error || "Connection failed";
        const lines = error.split("\n").filter(line => line.trim());
        const title = lines[0] || "Connection Failed";
        const description = lines.slice(1).join("\n") || "Please check your connection settings.";
        
        toast.error(title, {
          description: description,
          duration: 10000,
        });
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setTesting(false);
    }
  }

  const onSubmit = async (data: { name: string; type: "MYSQL" | "POSTGRES" | "MONGODB"; host: string; port: number; username: string; password: string; databaseName: string }) => {
    setLoading(true);
    try {
      const url = datasource ? `/api/datasources/${datasource.id}` : "/api/datasources";
      const method = datasource ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to save datasource");
        return;
      }

      toast.success(datasource ? "Datasource updated" : "Datasource created");
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
          <DialogTitle>{datasource ? "Edit Datasource" : "Create Datasource"}</DialogTitle>
          <DialogDescription>
            {datasource
              ? "Update the datasource configuration"
              : "Add a new database connection"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} placeholder="Production DB" />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Database Type</Label>
            <Select
              value={watch("type")}
              onValueChange={(value: any) => setValue("type", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MYSQL">MySQL</SelectItem>
                <SelectItem value="POSTGRES">PostgreSQL</SelectItem>
                <SelectItem value="MONGODB">MongoDB</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="host">Host</Label>
            <Input id="host" {...register("host")} placeholder="localhost" />
            {errors.host && (
              <p className="text-sm text-destructive">{errors.host.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              {...register("port", { valueAsNumber: true })}
            />
            {errors.port && (
              <p className="text-sm text-destructive">{errors.port.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...register("username")} />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder={datasource ? "Leave empty to keep current" : ""}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="databaseName">Database Name</Label>
            <Input id="databaseName" {...register("databaseName")} />
            {errors.databaseName && (
              <p className="text-sm text-destructive">
                {errors.databaseName.message as string}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || loading}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : datasource ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

