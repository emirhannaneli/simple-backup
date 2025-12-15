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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatasourceForm } from "@/components/datasource-form";
import { Plus, Edit, Trash2, Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function DatasourcesPage() {
  const [datasources, setDatasources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDatasource, setSelectedDatasource] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [datasourceToDelete, setDatasourceToDelete] = useState<string | null>(null);
  const [clientStatusOpen, setClientStatusOpen] = useState(false);
  const [clientStatus, setClientStatus] = useState<Record<string, { installed: boolean; command?: string }>>({});
  const [installingClient, setInstallingClient] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("USER");

  useEffect(() => {
    fetchDatasources();
    fetchUserRole();
    // Fetch client status on page load if user is admin
    fetchClientStatus();
  }, []);

  async function fetchUserRole() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  }

  async function fetchClientStatus() {
    try {
      const res = await fetch("/api/clients/install");
      const data = await res.json();
      if (data.clients) {
        const statusMap: Record<string, { installed: boolean; command?: string }> = {};
        data.clients.forEach((client: any) => {
          statusMap[client.dbType] = {
            installed: client.installed === true, // Ensure boolean
            command: client.command,
          };
        });
        setClientStatus(statusMap);
        console.log("Client status updated:", statusMap);
      }
    } catch (error) {
      console.error("Error fetching client status:", error);
    }
  }

  async function handleInstallClient(dbType: string) {
    setInstallingClient(dbType);
    try {
      const response = await fetch("/api/clients/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbType }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || "Client installed successfully");
        // Refresh client status after installation
        // Wait a bit to ensure installation is fully complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchClientStatus();
      } else {
        toast.error(result.message || "Failed to install client");
      }
    } catch (error) {
      toast.error("An error occurred while installing client");
    } finally {
      setInstallingClient(null);
    }
  }

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
        <div className="flex gap-2">
          {userRole === "ADMIN" && (
            <Button
              variant="outline"
              onClick={() => {
                fetchClientStatus();
                setClientStatusOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Client Status
            </Button>
          )}
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeBadge(datasource.type)}
                      {datasource.type !== "SQLITE" && userRole === "ADMIN" && (
                        <TooltipProvider>
                          {clientStatus[datasource.type]?.installed === true ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Client installed</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : clientStatus[datasource.type]?.installed === false ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <XCircle className="h-4 w-4 text-red-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Client not installed</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            // Status not yet loaded, show nothing or loading indicator
                            null
                          )}
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
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

      <Dialog open={clientStatusOpen} onOpenChange={setClientStatusOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Database Client Status</DialogTitle>
            <DialogDescription>
              Check and install database client tools. Only admins can install clients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {Object.entries(clientStatus).length === 0 ? (
              <div className="text-center text-muted-foreground py-4">Loading client status...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Database Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Command</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(clientStatus).map(([dbType, status]) => (
                      <TableRow key={dbType}>
                        <TableCell className="font-medium">{dbType}</TableCell>
                        <TableCell>
                          {status.installed ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Installed
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Not Installed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{status.command || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          {!status.installed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInstallClient(dbType)}
                              disabled={installingClient === dbType}
                            >
                              {installingClient === dbType ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Installing...
                                </>
                              ) : (
                                <>
                                  <Download className="mr-2 h-4 w-4" />
                                  Install
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientStatusOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

