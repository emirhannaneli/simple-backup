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
  } = useForm<{
    name: string;
    type: "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS" | "CASSANDRA" | "ELASTICSEARCH" | "INFLUXDB" | "NEO4J" | "SQLITE" | "H2";
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    databaseName: string;
    authSource?: string;
  }>({
    resolver: zodResolver(datasourceSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      type: "MYSQL" as const,
      host: "",
      port: 3306,
      username: "",
      password: "",
      databaseName: "",
      authSource: "",
    },
  });

  const dbType = watch("type");

  useEffect(() => {
    if (open) {
      if (datasource) {
        reset({
          name: datasource.name,
          type: datasource.type as "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS" | "CASSANDRA" | "ELASTICSEARCH" | "INFLUXDB" | "NEO4J" | "SQLITE" | "H2",
          host: datasource.host,
          port: datasource.port,
          username: datasource.username,
          password: "", // Don't pre-fill password
          databaseName: datasource.databaseName,
          authSource: datasource.authSource || "",
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
          authSource: "",
        });
      }
    }
  }, [open, datasource, reset]);

  useEffect(() => {
    // Set default port based on type
    const defaultPorts: Record<string, number> = {
      MYSQL: 3306,
      POSTGRES: 5432,
      MONGODB: 27017,
      REDIS: 6379,
      CASSANDRA: 9042,
      ELASTICSEARCH: 9200,
      INFLUXDB: 8086,
      NEO4J: 7687,
      SQLITE: 0, // Not applicable
      H2: 8082,
    };
    
    if (defaultPorts[dbType] !== undefined && dbType !== "SQLITE") {
      setValue("port", defaultPorts[dbType]);
    }
    
    // Clear host/port for SQLite
    if (dbType === "SQLITE") {
      setValue("host", "");
      setValue("port", 0);
    }
    
    // Set default authSource for MongoDB
    if (dbType === "MONGODB") {
      if (!datasource || !datasource.authSource) {
        setValue("authSource", "admin");
      }
    } else {
      // Clear authSource if not MongoDB, unless editing
      if (!datasource) {
        setValue("authSource", "");
      }
    }
  }, [dbType, setValue, datasource]);

  async function handleTest() {
    const formData = watch();
    setTesting(true);
    try {
      // For updates, if password is empty, use the existing datasource's password
      let testRes: Response;
      
      if (datasource && (!formData.password || formData.password.trim() === "")) {
        // Use the existing datasource's test endpoint which uses the stored password
        // But we need to update the datasource first with the new connection details (except password)
        // Or use a special test endpoint that accepts partial updates
        
        // For now, use the existing datasource test endpoint with current form data
        // We'll create a test with updated connection info but existing password
        const testData = {
          ...formData,
          // Remove password so the endpoint uses the stored one
          password: undefined,
        };
        
        // Use the datasource-specific test endpoint which will use stored password
        testRes = await fetch(`/api/datasources/${datasource.id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Send updated connection info (host, port, username, databaseName)
            // Password will be taken from stored datasource
            host: formData.host,
            port: formData.port,
            username: formData.username,
            databaseName: formData.databaseName,
          }),
        });
      } else {
        // Test connection directly with form data (no need to save)
        testRes = await fetch("/api/datasources/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      const result = await testRes.json();

      if (result.success) {
        // Parse multi-line success message
        const message = result.message || "Connection successful!";
        const lines = message.split("\n").filter((line: string) => line.trim());
        const title = lines[0] || "Connection Successful";
        const description = lines.slice(1).join("\n") || "Database connection verified.";
        
        toast.success(title, {
          description: description,
          duration: 6000,
        });
      } else {
        // Parse multi-line error message
        const error = result.error || "Connection failed";
        const lines = error.split("\n").filter((line: string) => line.trim());
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

  const onSubmit = async (data: { name: string; type: string; host?: string; port?: number; username?: string; password?: string; databaseName: string; authSource?: string }) => {
    setLoading(true);
    try {
      const url = datasource ? `/api/datasources/${datasource.id}` : "/api/datasources";
      const method = datasource ? "PUT" : "POST";

      // For updates, if password is empty or undefined, don't include it in payload (to keep existing password)
      let payload: any = { ...data };
      if (datasource) {
        // Remove password field if it's empty or undefined to keep existing password
        if (!data.password || data.password.trim() === "") {
          delete payload.password;
        }
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
                <SelectItem value="REDIS">Redis</SelectItem>
                <SelectItem value="CASSANDRA">Cassandra</SelectItem>
                <SelectItem value="ELASTICSEARCH">Elasticsearch</SelectItem>
                <SelectItem value="INFLUXDB">InfluxDB</SelectItem>
                <SelectItem value="NEO4J">Neo4j</SelectItem>
                <SelectItem value="SQLITE">SQLite</SelectItem>
                <SelectItem value="H2">H2</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message as string}</p>
            )}
          </div>

          {dbType !== "SQLITE" && (
            <>
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
            </>
          )}

          {dbType !== "SQLITE" && (
            <>
              {dbType !== "REDIS" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" {...register("username")} placeholder={dbType === "H2" ? "sa (default)" : ""} />
                    {errors.username && (
                      <p className="text-sm text-destructive">{errors.username.message as string}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password {datasource && <span className="text-muted-foreground text-xs">(leave empty to keep current)</span>}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      {...register("password", {
                        required: datasource ? false : "Password is required for this database type",
                        validate: (value) => {
                          // For updates, password is optional
                          if (datasource) {
                            return true;
                          }
                          // For new datasources, validate based on type
                          const dbType = watch("type");
                          if (dbType === "SQLITE" || dbType === "REDIS") {
                            return true;
                          }
                          if (dbType === "H2" && watch("databaseName")?.startsWith("jdbc:h2:file:")) {
                            return true;
                          }
                          if (!value || value.trim() === "") {
                            return "Password is required for this database type";
                          }
                          return true;
                        },
                      })}
                      placeholder={datasource ? "Leave empty to keep current" : ""}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message as string}</p>
                    )}
                  </div>
                </>
              )}

              {dbType === "REDIS" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username (Optional)</Label>
                    <Input id="username" {...register("username")} placeholder="Optional - Redis 6+ ACL" />
                    {errors.username && (
                      <p className="text-sm text-destructive">{errors.username.message as string}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password (Optional)</Label>
                    <Input
                      id="password"
                      type="password"
                      {...register("password")}
                      placeholder="Optional - Leave empty if no auth"
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message as string}</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="databaseName">
              {dbType === "SQLITE" 
                ? "Database File Path" 
                : dbType === "H2" 
                ? "Database Path or JDBC URL" 
                : dbType === "REDIS"
                ? "Database Index (0-15, optional)"
                : dbType === "ELASTICSEARCH"
                ? "Repository Name"
                : "Database Name"}
            </Label>
            <Input 
              id="databaseName" 
              {...register("databaseName")} 
              placeholder={
                dbType === "SQLITE" 
                  ? "/path/to/database.db" 
                  : dbType === "H2" 
                  ? "jdbc:h2:file:/path/to/db or /path/to/db" 
                  : dbType === "REDIS"
                  ? "0 (default)"
                  : dbType === "ELASTICSEARCH"
                  ? "backup_repo"
                  : "mydb"
              }
            />
            {errors.databaseName && (
              <p className="text-sm text-destructive">
                {errors.databaseName.message as string}
              </p>
            )}
          </div>

          {dbType === "MONGODB" && (
            <div className="space-y-2">
              <Label htmlFor="authSource">Authentication Database (Optional)</Label>
              <Input 
                id="authSource" 
                {...register("authSource")} 
                placeholder="admin (default)" 
              />
              <p className="text-xs text-muted-foreground">
                The database where the user was created (defaults to admin).
              </p>
              {errors.authSource && (
                <p className="text-sm text-destructive">
                  {errors.authSource.message as string}
                </p>
              )}
            </div>
          )}

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

