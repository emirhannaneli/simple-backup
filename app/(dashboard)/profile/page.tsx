"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Lock, Save } from "lucide-react";
import { z } from "zod";

const profileSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        toast.error("Failed to fetch user data");
        return;
      }
      const data = await res.json();
      setUser(data.user);
      resetProfile({ username: data.user.username });
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile(data: ProfileFormData) {
    if (!user) return;

    setUpdatingProfile(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to update profile");
        return;
      }

      toast.success("Profile updated successfully");
      fetchUser();
      // Refresh the page to update the JWT token with new username
      router.refresh();
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setUpdatingProfile(false);
    }
  }

  async function handleUpdatePassword(data: PasswordFormData) {
    if (!user) return;

    setUpdatingPassword(true);
    try {
      const response = await fetch(`/api/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully");
      resetPassword();
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setUpdatingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
          <p className="text-sm md:text-base text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
          <p className="text-sm md:text-base text-muted-foreground">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
        <p className="text-sm md:text-base text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle className="text-lg md:text-xl">Profile Information</CardTitle>
            </div>
            <CardDescription className="text-sm">Update your username</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitProfile(handleUpdateProfile)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...registerProfile("username")}
                  placeholder="Enter username"
                  disabled={updatingProfile}
                />
                {profileErrors.username && (
                  <p className="text-sm text-destructive">{profileErrors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user.role}
                  disabled
                  className="bg-muted"
                />
              </div>

              <Button type="submit" disabled={updatingProfile} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {updatingProfile ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle className="text-lg md:text-xl">Change Password</CardTitle>
            </div>
            <CardDescription className="text-sm">Update your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPassword(handleUpdatePassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...registerPassword("currentPassword")}
                  placeholder="Enter current password"
                  disabled={updatingPassword}
                />
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...registerPassword("newPassword")}
                  placeholder="Enter new password"
                  disabled={updatingPassword}
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...registerPassword("confirmPassword")}
                  placeholder="Confirm new password"
                  disabled={updatingPassword}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" disabled={updatingPassword} className="w-full sm:w-auto">
                <Lock className="mr-2 h-4 w-4" />
                {updatingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

