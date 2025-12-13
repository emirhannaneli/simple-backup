"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const API_BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={copyToClipboard}
        className="absolute right-2 top-2 p-2 rounded-md hover:bg-muted transition-colors"
        title="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="bg-muted p-3 md:p-4 rounded-lg overflow-x-auto text-xs md:text-sm max-w-full">
        <code className="break-words whitespace-pre-wrap">{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">API Documentation</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Complete API reference for Simple Backup
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base URL</CardTitle>
          <CardDescription>All API endpoints are relative to this base URL</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={API_BASE_URL} language="text" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Authentication</CardTitle>
          <CardDescription className="text-sm">Two authentication methods are supported</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Session-based (Web UI)</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Used by the web interface. Login via <code className="bg-muted px-1 rounded">POST /api/auth/login</code> to
              receive an HTTP-only cookie.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. API Key (External)</h3>
            <p className="text-sm text-muted-foreground mb-2">
              For external integrations. Include the API key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header.
            </p>
            <CodeBlock
              code={`X-API-Key: your-api-key-here`}
              language="text"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trigger" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="trigger" className="text-xs sm:text-sm">Trigger Backup</TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs sm:text-sm">Jobs</TabsTrigger>
          <TabsTrigger value="backups" className="text-xs sm:text-sm">Backups</TabsTrigger>
          <TabsTrigger value="datasources" className="text-xs sm:text-sm">Datasources</TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs sm:text-sm">Webhooks</TabsTrigger>
          <TabsTrigger value="auth" className="text-xs sm:text-sm">Authentication</TabsTrigger>
        </TabsList>

        <TabsContent value="trigger" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/trigger/[jobId]</CardTitle>
              </div>
              <CardDescription className="text-sm">Manually trigger a backup job (requires API key)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Headers</h3>
                <CodeBlock
                  code={`X-API-Key: your-api-key-here`}
                  language="text"
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      message: "Backup started",
                      jobId: "clx1234567890",
                    },
                    null,
                    2
                  )}
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Example (cURL)</h3>
                <CodeBlock
                  code={`curl -X POST ${API_BASE_URL}/api/trigger/clx1234567890 \\
  -H "X-API-Key: your-api-key-here"`}
                  language="bash"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline">GET</Badge>
                <CardTitle>/api/jobs</CardTitle>
              </div>
              <CardDescription>List all backup jobs (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      jobs: [
                        {
                          id: "clx1234567890",
                          title: "Daily MySQL Backup",
                          datasourceId: "clx0987654321",
                          cronExpression: "0 2 * * *",
                          destinationPath: "./backups/mysql",
                          status: "IDLE",
                          isActive: true,
                          createdAt: "2024-01-01T00:00:00.000Z",
                        },
                      ],
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/jobs</CardTitle>
              </div>
              <CardDescription className="text-sm">Create a new backup job (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Body</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      title: "Daily MySQL Backup",
                      datasourceId: "clx0987654321",
                      cronExpression: "0 2 * * *",
                      destinationPath: "./backups/mysql",
                      isActive: true,
                    },
                    null,
                    2
                  )}
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Response (201 Created)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      job: {
                        id: "clx1234567890",
                        title: "Daily MySQL Backup",
                        datasourceId: "clx0987654321",
                        cronExpression: "0 2 * * *",
                        destinationPath: "./backups/mysql",
                        status: "IDLE",
                        isActive: true,
                        createdAt: "2024-01-01T00:00:00.000Z",
                      },
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline">GET</Badge>
                <CardTitle>/api/jobs/[id]</CardTitle>
              </div>
              <CardDescription>Get a specific job (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline">PUT</Badge>
                <CardTitle>/api/jobs/[id]</CardTitle>
              </div>
              <CardDescription>Update a job (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="text-xs">DELETE</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/jobs/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Delete a job (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/jobs/[id]/run</CardTitle>
              </div>
              <CardDescription className="text-sm">Manually run a job (requires authentication)</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/backups</CardTitle>
              </div>
              <CardDescription className="text-sm">List all backups (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      backups: [
                        {
                          id: "clx1234567890",
                          jobId: "clx0987654321",
                          filename: "backup_20240101_020000.sql",
                          filePath: "./backups/mysql/backup_20240101_020000.sql",
                          size: 1048576,
                          status: "SUCCESS",
                          durationMs: 5000,
                          errorMessage: null,
                          createdAt: "2024-01-01T02:00:00.000Z",
                        },
                      ],
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/backups/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Get a specific backup (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/backups/[id]/download</CardTitle>
              </div>
              <CardDescription className="text-sm">Download a backup file (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="text-xs">DELETE</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/backups/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Delete a backup (requires authentication)</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="datasources" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/datasources</CardTitle>
              </div>
              <CardDescription className="text-sm">List all datasources (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      datasources: [
                        {
                          id: "clx0987654321",
                          name: "Production MySQL",
                          type: "MYSQL",
                          host: "localhost",
                          port: 3306,
                          username: "root",
                          databaseName: "mydb",
                          createdAt: "2024-01-01T00:00:00.000Z",
                          _count: {
                            jobs: 3,
                          },
                        },
                      ],
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/datasources</CardTitle>
              </div>
              <CardDescription className="text-sm">Create a new datasource (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Body</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      name: "Production MySQL",
                      type: "MYSQL",
                      host: "localhost",
                      port: 3306,
                      username: "root",
                      password: "secretpassword",
                      databaseName: "mydb",
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/datasources/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Get a specific datasource (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">PUT</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/datasources/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Update a datasource (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="text-xs">DELETE</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/datasources/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Delete a datasource (requires authentication)</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/datasources/[id]/test</CardTitle>
              </div>
              <CardDescription className="text-sm">Test datasource connection (requires authentication)</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/webhooks</CardTitle>
              </div>
              <CardDescription className="text-sm">List all webhooks (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      webhooks: [
                        {
                          id: "clx1234567890",
                          url: "https://example.com/webhook",
                          method: "POST",
                          events: ["JOB_SUCCESS", "JOB_FAILURE"],
                          headers: {
                            "Authorization": "Bearer token",
                            "X-Custom-Header": "value"
                          },
                          isActive: true,
                          createdAt: "2024-01-01T00:00:00.000Z",
                        },
                      ],
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/webhooks</CardTitle>
              </div>
              <CardDescription className="text-sm">Create a new webhook (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Body</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      url: "https://example.com/webhook",
                      method: "POST",
                      events: ["JOB_SUCCESS", "JOB_FAILURE"],
                      headers: {
                        "Authorization": "Bearer token",
                        "X-Custom-Header": "value"
                      },
                      isActive: true,
                    },
                    null,
                    2
                  )}
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Request Fields</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code className="bg-muted px-1 rounded">url</code> (required): Webhook endpoint URL</li>
                  <li><code className="bg-muted px-1 rounded">method</code> (optional): HTTP method (GET, POST, PUT, PATCH) - default: POST</li>
                  <li><code className="bg-muted px-1 rounded">events</code> (required): Array of events to subscribe to (JOB_SUCCESS, JOB_FAILURE)</li>
                  <li><code className="bg-muted px-1 rounded">headers</code> (optional): Custom headers as key-value pairs (JSON object)</li>
                  <li><code className="bg-muted px-1 rounded">isActive</code> (optional): Whether the webhook is active - default: true</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Webhook Payload</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  When a backup job completes, webhooks receive the following payload:
                </p>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      event_type: "backup-webhook",
                      client_payload: {
                        jobId: "cmj3hnfsc0006fupg0tp4c6xf",
                        event: "JOB_SUCCESS",
                        details: {
                          file: "Daily_MySQL_Backup_2024-01-15T10-30-00-000Z.sql",
                          size: "15.2 MB",
                          error: null
                        }
                      }
                    },
                    null,
                    2
                  )}
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Custom Headers</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  You can add custom headers to webhook requests. These headers will be merged with the default <code className="bg-muted px-1 rounded">Content-Type: application/json</code> header.
                </p>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      "Authorization": "Bearer your-token-here",
                      "X-API-Key": "your-api-key",
                      "X-Custom-Header": "custom-value"
                    },
                    null,
                    2
                  )}
                />
                <div className="mt-3 space-y-2">
                  <h4 className="font-semibold text-sm">Environment Variable Support</h4>
                  <p className="text-sm text-muted-foreground">
                    You can use environment variables in header values using <code className="bg-muted px-1 rounded">${`{VAR_NAME}`}</code> or <code className="bg-muted px-1 rounded">$VAR_NAME</code> syntax:
                  </p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        "Authorization": "Bearer ${WEBHOOK_TOKEN}",
                        "X-API-Key": "$API_KEY",
                        "X-Environment": "${NODE_ENV}"
                      },
                      null,
                      2
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Environment variables are resolved at runtime when the webhook is triggered. If a variable is not found, the original string (including the variable syntax) will be used.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">PUT</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/webhooks/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Update a webhook (requires authentication)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Body</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      url: "https://example.com/webhook",
                      method: "POST",
                      events: ["JOB_SUCCESS"],
                      headers: {
                        "Authorization": "Bearer token"
                      },
                      isActive: true,
                    },
                    null,
                    2
                  )}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Same fields as POST /api/webhooks. All fields are optional for updates.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="text-xs">DELETE</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/webhooks/[id]</CardTitle>
              </div>
              <CardDescription className="text-sm">Delete a webhook (requires authentication)</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/auth/login</CardTitle>
              </div>
              <CardDescription className="text-sm">Login and receive session cookie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Body</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      username: "admin",
                      password: "admin",
                    },
                    null,
                    2
                  )}
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      user: {
                        id: "clx1234567890",
                        username: "admin",
                        role: "ADMIN",
                      },
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">POST</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/auth/logout</CardTitle>
              </div>
              <CardDescription className="text-sm">Logout and clear session cookie</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">GET</Badge>
                <CardTitle className="text-base md:text-lg break-all">/api/auth/me</CardTitle>
              </div>
              <CardDescription className="text-sm">Get current user information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Response (200 OK)</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      user: {
                        id: "clx1234567890",
                        username: "admin",
                        role: "ADMIN",
                      },
                    },
                    null,
                    2
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Error Responses</CardTitle>
          <CardDescription className="text-sm">All endpoints return errors in a consistent format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">401 Unauthorized</h3>
            <CodeBlock
              code={JSON.stringify(
                {
                  error: "Unauthorized",
                },
                null,
                2
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold mb-2">400 Bad Request</h3>
            <CodeBlock
              code={JSON.stringify(
                {
                  error: "Invalid request",
                },
                null,
                2
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold mb-2">404 Not Found</h3>
            <CodeBlock
              code={JSON.stringify(
                {
                  error: "Resource not found",
                },
                null,
                2
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

