import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    // Re-verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyError) {
      setLoading(false);
      return toast.error("Current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) return toast.error(error.message);
    setCurrent(""); setNext(""); setConfirm("");
    toast.success("Password changed successfully");
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Enter your current password and choose a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">New password</Label>
              <Input id="next" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
