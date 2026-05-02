import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Mail, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast({ title: "Sign-in failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome back" });
    nav(loc.state?.from || "/dashboard", { replace: true });
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to NexusEdu."
      footer={<>New here? <Link to="/signup" className="text-primary hover:underline font-medium">Create account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11" placeholder="you@example.com" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-foreground-muted hover:text-primary">Forgot?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-11" placeholder="••••••••" />
          </div>
        </div>
        <Button type="submit" disabled={busy} data-variant="primary-cta" className="w-full h-11 mb-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/phone-login" className="text-sm font-medium text-foreground-muted hover:text-primary transition-colors">
          Or login with phone number
        </Link>
      </div>
    </AuthShell>
  );
}
