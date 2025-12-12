"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, HelpCircle } from "lucide-react";

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *", description: "Runs every minute" },
  { label: "Every 5 minutes", value: "*/5 * * * *", description: "Runs every 5 minutes" },
  { label: "Every 15 minutes", value: "*/15 * * * *", description: "Runs every 15 minutes" },
  { label: "Every 30 minutes", value: "*/30 * * * *", description: "Runs every 30 minutes" },
  { label: "Every hour", value: "0 * * * *", description: "Runs every hour" },
  { label: "Every 6 hours", value: "0 */6 * * *", description: "Runs every 6 hours" },
  { label: "Every 12 hours", value: "0 */12 * * *", description: "Runs every 12 hours" },
  { label: "Daily (Midnight)", value: "0 0 * * *", description: "Runs daily at midnight" },
  { label: "Daily (2:00 AM)", value: "0 2 * * *", description: "Runs daily at 2:00 AM" },
  { label: "Weekly (Sunday midnight)", value: "0 0 * * 0", description: "Runs every Sunday at midnight" },
  { label: "Monthly (1st day midnight)", value: "0 0 1 * *", description: "Runs on the 1st day of every month at midnight" },
];

function parseCronExpression(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return "Invalid cron expression";
  }

  const [minute, hour, day, month, weekday] = parts;

  let description = "";

  // Minute
  if (minute === "*") {
    description += "Every minute";
  } else if (minute.startsWith("*/")) {
    const interval = minute.substring(2);
    description += `Every ${interval} minutes`;
  } else {
    description += `At minute ${minute}`;
  }

  // Hour
  if (hour === "*") {
    if (minute !== "*" && !minute.startsWith("*/")) {
      description += `, every hour`;
    }
  } else if (hour.startsWith("*/")) {
    const interval = hour.substring(2);
    description += `, every ${interval} hours`;
  } else {
    description += `, at ${hour}:00`;
  }

  // Day
  if (day === "*") {
    description += ", every day";
  } else if (day.startsWith("*/")) {
    const interval = day.substring(2);
    description += `, every ${interval} days`;
  } else {
    description += `, on day ${day} of the month`;
  }

  // Month
  if (month === "*") {
    if (day !== "*" && !day.startsWith("*/")) {
      description += ", every month";
    }
  } else if (month.startsWith("*/")) {
    const interval = month.substring(2);
    description += `, every ${interval} months`;
  } else {
    const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    description += `, in ${months[parseInt(month)] || month}`;
  }

  // Weekday
  if (weekday !== "*") {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    if (weekday.includes(",")) {
      const days = weekday.split(",").map((d) => weekdays[parseInt(d)] || d);
      description += `, on ${days.join(", ")}`;
    } else if (weekday.startsWith("*/")) {
      const interval = weekday.substring(2);
      description += `, every ${interval} weeks`;
    } else {
      description += `, on ${weekdays[parseInt(weekday)] || weekday}`;
    }
  }

  return description;
}

interface CronHelperProps {
  value: string;
  onChange: (value: string) => void;
}

export function CronHelper({ value, onChange }: CronHelperProps) {
  const [open, setOpen] = useState(false);
  const [customCron, setCustomCron] = useState(value);

  const handlePresetSelect = (presetValue: string) => {
    onChange(presetValue);
    setCustomCron(presetValue);
  };

  const handleCustomCronChange = (newValue: string) => {
    setCustomCron(newValue);
    onChange(newValue);
  };

  const cronDescription = value ? parseCronExpression(value) : "Select or enter a cron expression";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="cronExpression">Cron Expression</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-4 w-4">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="start">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cron Expression Helper</CardTitle>
                <CardDescription className="text-xs">
                  Format: minute hour day month weekday
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs mb-2 block">Presets</Label>
                  <Select value={customCron} onValueChange={handlePresetSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div>
                            <div className="font-medium">{preset.label}</div>
                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Custom Cron Expression</Label>
                  <Input
                    value={customCron}
                    onChange={(e) => handleCustomCronChange(e.target.value)}
                    placeholder="0 0 * * *"
                    className="font-mono text-sm"
                  />
                  {customCron && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {parseCronExpression(customCron)}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Examples:</strong></p>
                  <p><code className="bg-muted px-1 rounded">0 0 * * *</code> - Daily at midnight</p>
                  <p><code className="bg-muted px-1 rounded">0 */6 * * *</code> - Every 6 hours</p>
                  <p><code className="bg-muted px-1 rounded">0 2 * * 1</code> - Every Monday at 2:00 AM</p>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-2">
        <Input
          id="cronExpression"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0 0 * * *"
          className="font-mono"
        />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Quick select" />
          </SelectTrigger>
          <SelectContent>
            {CRON_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{cronDescription}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Format: <code className="bg-muted px-1 rounded">minute hour day month weekday</code>
      </p>
    </div>
  );
}

