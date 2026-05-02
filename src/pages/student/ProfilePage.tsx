import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { profile, user, isAdmin, refresh, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: name, phone }).eq("id", user.id);
    setBusy(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    await refresh();
    toast({ title: "Profile updated" });
  };
  
  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  }

  const initial = profile?.display_name?.charAt(0).toUpperCase() ?? "U";
  return (
    <div className="container max-w-2xl py-10 space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Account</p>
        <h1 className="font-display text-4xl font-bold tracking-tighter">Your profile</h1>
      </div>

      <div className="rounded-2xl p-7 bg-background-elevated border border-border flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-3xl font-bold shadow-glow">{initial}</div>
        <div>
          <p className="font-display text-xl font-semibold">{profile?.display_name ?? "Student"}</p>
          <p className="text-sm text-foreground-muted">{profile?.email}</p>
          {profile?.phone && <p className="text-sm text-foreground-muted mt-0.5">{profile.phone}</p>}
          {isAdmin && <span className="inline-flex items-center gap-1 mt-2 text-xs text-accent"><ShieldCheck className="w-3.5 h-3.5" /> Administrator</span>}
        </div>
      </div>

      <div className="rounded-2xl p-7 bg-background-elevated border border-border space-y-4">
        <div className="space-y-2"><Label htmlFor="p-name">Display name</Label><Input id="p-name" value={name} onChange={e => setName(e.target.value)} className="h-11" /></div>
        <div className="space-y-2"><Label htmlFor="p-phone">Phone</Label><Input id="p-phone" value={phone} onChange={e => setPhone(e.target.value)} className="h-11" placeholder="+880…" /></div>
        <div className="flex gap-3 pt-2">
          <Button onClick={save} disabled={busy} className="rounded-full bg-primary hover:bg-primary-glow font-semibold shadow-glow">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </Button>
          <Button onClick={handleSignOut} variant="outline" className="rounded-full border-white/10 hover:bg-white/5 text-destructive hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-2xl p-7 bg-background-elevated border border-border border-l-4 border-l-accent flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-lg">Admin Control</h2>
            <p className="text-sm text-foreground-muted">Manage users, content, and system settings.</p>
          </div>
          <Button asChild className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/admin">
              <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
