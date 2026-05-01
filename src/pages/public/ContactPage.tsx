import { useState } from "react";
import { Mail, MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ContactPage() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Log it as an activity for admins to see (works only if signed in)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "contact_form_submit",
        details: form as any,
      });
    }
    setBusy(false);
    setForm({ name: "", email: "", message: "" });
    toast({ title: "Message sent", description: "We'll reply within 24 hours." });
  };

  return (
    <>
      <section className="container max-w-5xl py-20">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Get in touch</p>
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter mb-12 text-gradient">
          Talk to the team.
        </h1>
        <div className="grid md:grid-cols-5 gap-10">
          <div className="md:col-span-2 space-y-5">
            <div className="rounded-2xl p-6 bg-background-elevated border border-border">
              <Mail className="w-6 h-6 text-primary mb-3" />
              <p className="font-medium mb-1">Email</p>
              <a href="mailto:hello@nexusedu.app" className="text-sm text-foreground-dim hover:text-foreground">hello@nexusedu.app</a>
            </div>
            <div className="rounded-2xl p-6 bg-background-elevated border border-border">
              <MessageCircle className="w-6 h-6 text-accent mb-3" />
              <p className="font-medium mb-1">Support</p>
              <p className="text-sm text-foreground-dim">Mon–Fri · 10:00 to 20:00 (BST)</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="md:col-span-3 rounded-2xl p-7 bg-background-elevated border border-border space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="c-name">Name</Label><Input id="c-name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="h-11" /></div>
              <div className="space-y-2"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="h-11" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="c-message">Message</Label><Textarea id="c-message" required rows={5} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} /></div>
            <Button type="submit" disabled={busy} className="w-full h-11 rounded-full bg-primary hover:bg-primary-glow font-semibold shadow-glow">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Send message</>}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
