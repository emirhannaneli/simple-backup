"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lock, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { useRouter } from "next/navigation";

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface ForcePasswordChangeModalProps {
  userId: string;
  open: boolean;
}

export function ForcePasswordChangeModal({ userId, open }: ForcePasswordChangeModalProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  async function handleUpdatePassword(data: PasswordFormData) {
    setUpdating(true);
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "admin", // Default password
          newPassword: data.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully. Please login again.");
      reset();
      
      // Logout and redirect to login
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-lg md:text-xl">Change Default Password</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            You are using the default password. For security reasons, you must change your password before continuing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleUpdatePassword)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              {...register("newPassword")}
              placeholder="Enter new password"
              disabled={updating}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
              placeholder="Confirm new password"
              disabled={updating}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={updating} className="w-full">
            <Lock className="mr-2 h-4 w-4" />
            {updating ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

