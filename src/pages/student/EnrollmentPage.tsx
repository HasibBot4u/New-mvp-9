import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";

export default function EnrollmentPage() {
  const [chapters, setChapters] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [form, setForm] = useState({
    transactionId: "",
    amount: "",
    paymentMethod: "bkash"
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const [subs, cycs, chaps] = await Promise.all([
        supabase.from("subjects").select("*").eq("is_active", true).order("display_order"),
        supabase.from("cycles").select("*").eq("is_active", true).order("display_order"),
        supabase.from("chapters").select("*").eq("is_active", true).order("display_order"),
      ]);

      setSubjects(subs.data || []);
      setCycles(cycs.data || []);
      // Only keep chapters that require enrollment
      setChapters((chaps.data || []).filter(c => c.requires_enrollment));
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapter) {
      toast({ title: "Error", description: "অনুগ্রহ করে একটি কোর্স/চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
      return;
    }
    if (!form.transactionId || !form.amount) {
      toast({ title: "Error", description: "সব তথ্য প্রদান করুন", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({ title: "Error", description: "Please login first", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("pending_enrollments" as any).insert({
      user_id: userData.user.id,
      chapter_id: selectedChapter,
      transaction_id: form.transactionId,
      payment_method: form.paymentMethod,
      amount: parseFloat(form.amount),
      status: "pending"
    });

    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      trackEvent("chapter_enroll", { chapter_id: selectedChapter, amount: form.amount });
      toast({ title: "Success", description: "আপনার রিকোয়েস্ট সফলভাবে জমা হয়েছে। অ্যাডমিন চেক করে অ্যাপ্রুভ করবেন।" });
      setForm({ transactionId: "", amount: "", paymentMethod: "bkash" });
      setSelectedChapter(null);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 md:pb-8">
      <header className="space-y-2 mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight bangla">এনরোলমেন্ট ফর্ম</h1>
        <p className="text-foreground-muted bangla">পেমেন্ট করে আপনার পছন্দের কোর্সে এনরোল করুন</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-bold bangla">কোর্স সমূহ</h3>
          <div className="space-y-3">
            {chapters.length > 0 ? (
              subjects.map(sub => {
                const subCycles = cycles.filter(c => c.subject_id === sub.id);
                return subCycles.map(cyc => {
                  const cycChaps = chapters.filter(chap => chap.cycle_id === cyc.id);
                  if (cycChaps.length === 0) return null;
                  
                  return (
                    <div key={cyc.id} className="space-y-2">
                      <div className="text-sm font-medium text-foreground-muted bg-white/5 px-3 py-1 rounded-md bangla">{sub.name_bn} &gt; {cyc.name_bn}</div>
                      {cycChaps.map(chap => (
                        <button
                          key={chap.id}
                          onClick={() => setSelectedChapter(chap.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-colors bangla flex flex-col gap-1
                            ${selectedChapter === chap.id 
                              ? 'border-primary bg-primary/10' 
                              : 'border-white/10 bg-surface hover:border-white/20'}`}
                        >
                          <span className="font-semibold text-foreground">{chap.name_bn || chap.name}</span>
                          <span className="text-xs text-foreground-muted">Premium Chapter</span>
                        </button>
                      ))}
                    </div>
                  );
                });
              })
            ) : (
              <p className="text-foreground-muted bangla text-sm">পেইড কোনো চ্যাপ্টার নেই</p>
            )}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-surface border border-white/5 rounded-2xl p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3 mb-6 p-4 bg-primary/10 rounded-xl border border-primary/20">
              <h4 className="font-medium bangla text-primary flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                কিভাবে পেমেন্ট করবেন?
              </h4>
              <ul className="text-sm text-foreground-muted bangla space-y-1 list-disc list-inside">
                <li>যেকোনো নাম্বার থেকে Send Money করুন</li>
                <li>বিকাশ/নগদ নাম্বার: 123456789 (Personal)</li>
                <li>ট্রানজেকশন আইডি এবং টাকার পরিমাণ সাবমিট করুন</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium bangla text-foreground-muted">পেমেন্ট মেথড</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                value={form.paymentMethod}
                onChange={e => setForm({...form, paymentMethod: e.target.value})}
              >
                <option value="bkash" className="bg-background">bKash</option>
                <option value="nagad" className="bg-background">Nagad</option>
                <option value="rocket" className="bg-background">Rocket</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium bangla text-foreground-muted">ট্রানজেকশন আইডি (Transaction ID)</label>
              <input
                required
                type="text"
                placeholder="TrxID (e.g. 9ABCDEF123)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                value={form.transactionId}
                onChange={e => setForm({...form, transactionId: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium bangla text-foreground-muted">টাকার পরিমাণ (Amount)</label>
              <input
                required
                type="number"
                placeholder="0.00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedChapter}
              className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors select-none bangla flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              রিকোয়েস্ট সাবমিট করুন
            </button>
            {!selectedChapter && (
              <p className="text-center text-xs text-red-400 bangla">আগে বাম পাশ থেকে কোর্স নির্বাচন করুন</p>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
