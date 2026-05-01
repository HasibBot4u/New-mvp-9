import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) { toast({ title: "Reset failed", description: error, variant: "destructive" }); return; }
    toast({ title: "Password updated" });
    nav("/dashboard", { replace: true });
  };

  return (
    <AuthShell title="Set new password" subtitle="Choose a strong password.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input id="password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-11" placeholder="At least 6 characters" />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full h-11 rounded-full bg-primary hover:bg-primary-glow font-semibold shadow-glow">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
