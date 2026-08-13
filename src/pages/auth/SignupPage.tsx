import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { AuthShell } from "@/features/auth/AuthShell";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { useSystemSettings } from "@/features/catalog/SystemSettingsContext";

export default function SignupPage() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const { settings } = useSystemSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Stage 3/4: the allow_registrations gate. NOTE: kept below ALL hooks —
  // an early return before useState calls violated the rules of hooks
  // (caught by CI lint). Client-side gate only; server-side enforcement
  // would need a Supabase Auth hook/DB trigger (documented residual).
  if (!settings.allow_registrations) {
    return (
      <AuthShell
        title="Sign-ups paused"
        subtitle="Registration is temporarily closed. Please try again later."
        footer={<>Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link></>}
      >
        <p className="text-sm text-foreground-muted text-center bangla">
          নতুন নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।
        </p>
      </AuthShell>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (error) {
      toast({ title: "Sign-up failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Account created", description: "Redirecting to your dashboard…" });
    nav("/dashboard", { replace: true });
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Free to start. No card needed."
      footer={<>Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input id="name" required value={name} onChange={e => setName(e.target.value)} className="pl-10 h-11" placeholder="Your name" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11" placeholder="you@example.com" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input id="password" type="password" required autoComplete="new-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-11" placeholder="At least 6 characters" />
          </div>
        </div>
        <Button type="submit" disabled={busy} data-variant="primary-cta" className="w-full h-11">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
        </Button>
        <p className="text-xs text-foreground-muted text-center">
          By continuing you agree to our <Link to="/terms" className="hover:text-foreground underline">Terms</Link> and <Link to="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
