"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WebhookLog {
  id: string;
  event: string;
  jobId: string | null;
  jobName: string | null;
  statusCode: number | null;
  success: boolean;
  requestBody: string;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface WebhookLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string | null;
}

export function WebhookLogsDialog({
  open,
  onOpenChange,
  webhookId,
}: WebhookLogsDialogProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (open && webhookId) {
      fetchLogs();
    } else {
      setLogs([]);
      setSelectedLog(null);
      setShowDetails(false);
    }
  }, [open, webhookId]);

  async function fetchLogs() {
    if (!webhookId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/logs?limit=100`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
      toast.error("Failed to fetch webhook logs");
    } finally {
      setLoading(false);
    }
  }

  function handleViewDetails(log: WebhookLog) {
    setSelectedLog(log);
    setShowDetails(true);
  }

  function getStatusBadge(log: WebhookLog) {
    if (log.success) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }
  }

  function getStatusCodeBadge(statusCode: number | null) {
    if (!statusCode) return <span className="text-muted-foreground">-</span>;
    
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="default">{statusCode}</Badge>;
    } else if (statusCode >= 300 && statusCode < 400) {
      return <Badge variant="secondary">{statusCode}</Badge>;
    } else {
      return <Badge variant="destructive">{statusCode}</Badge>;
    }
  }

  return (
    <>
      <Dialog open={open && !showDetails} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Webhook Logs</DialogTitle>
            <DialogDescription>
              View request history for this webhook
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs found for this webhook.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {formatRelativeTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.event}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{log.jobName || "N/A"}</div>
                            {log.jobId && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {log.jobId.substring(0, 8)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(log)}</TableCell>
                        <TableCell>{getStatusCodeBadge(log.statusCode)}</TableCell>
                        <TableCell>
                          {log.durationMs !== null ? `${log.durationMs}ms` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails && selectedLog !== null} onOpenChange={setShowDetails}>
        <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Webhook Request Details</DialogTitle>
            <DialogDescription>
              Request and response information
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="flex-1 overflow-auto space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Payload</h3>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(JSON.parse(selectedLog.requestBody), null, 2)}
                </pre>
              </div>
              {selectedLog.responseBody && (
                <div>
                  <h3 className="font-semibold mb-2">Response Body</h3>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-60">
                    {selectedLog.responseBody}
                  </pre>
                </div>
              )}
              {selectedLog.errorMessage && (
                <div>
                  <h3 className="font-semibold mb-2 text-destructive">Error</h3>
                  <pre className="bg-destructive/10 p-3 rounded-md text-xs text-destructive overflow-x-auto">
                    {selectedLog.errorMessage}
                  </pre>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status Code:</span>{" "}
                  {selectedLog.statusCode || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  {selectedLog.durationMs !== null ? `${selectedLog.durationMs}ms` : "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground">Event:</span> {selectedLog.event}
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span>{" "}
                  {formatRelativeTime(selectedLog.createdAt)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}



