import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await forgotPassword(email.trim());
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error, variant: "destructive" }); return; }
    setSent(true);
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll email you a reset link."
      footer={<Link to="/login" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-3 h-3" /> Back to sign in</Link>}
    >
      {sent ? (
        <div className="rounded-2xl glass p-6 text-center">
          <p className="font-medium text-foreground mb-1">Check your inbox</p>
          <p className="text-sm text-foreground-dim">We sent a reset link to <span className="text-foreground">{email}</span>.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11" placeholder="you@example.com" />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 rounded-full bg-primary hover:bg-primary-glow font-semibold shadow-glow">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
