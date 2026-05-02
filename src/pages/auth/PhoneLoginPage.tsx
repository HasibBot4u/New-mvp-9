import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NexusLogo } from "@/components/brand/NexusLogo";

export default function PhoneLoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    let formattedPhone = phone;
    if (formattedPhone.startsWith("01")) {
      formattedPhone = "+88" + formattedPhone;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPhone(formattedPhone);
      setStep("otp");
      toast({ title: "OTP Sent", description: "আপনার মোবাইলে একটি OTP পাঠানো হয়েছে।" });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) {
      setLoading(false);
      toast({ title: "Error", description: error.message || "ভুল OTP", variant: "destructive" });
    } else {
      if (data.user) {
        // Ensure profile has phone
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone: data.user.phone })
          .eq("id", data.user.id);
          
        if (profileError) {
           await supabase.from("profiles").insert({
             id: data.user.id,
             phone: data.user.phone,
             display_name: 'User_' + data.user.id.substring(0, 4)
           });
        }
      }
      setLoading(false);
      toast({ title: "Success", description: "লগইন সফল হয়েছে!" });
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8 bg-surface p-8 rounded-2xl border border-white/5 shadow-xl">
        <div className="text-center flex flex-col items-center">
          <NexusLogo size="lg" />
          <h2 className="text-2xl font-bold tracking-tight bangla mt-4">ফোন নাম্বার দিয়ে লগইন</h2>
          <p className="text-sm text-foreground-muted mt-2 bangla">আপনার ফোন নাম্বারে OTP পাঠানো হবে</p>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="phone" className="block text-sm font-medium text-foreground-muted bangla">ফোন নাম্বার</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-foreground-muted" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-10 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-foreground sm:text-sm transition-all"
                  placeholder="01XXXXXXXXX"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all bangla"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "OTP পাঠান"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-center">
              <p className="text-sm text-primary bangla">{phone} নাম্বারে কোড পাঠানো হয়েছে</p>
              <button 
                type="button" 
                onClick={() => setStep("phone")}
                className="text-xs text-foreground-muted hover:text-white underline mt-1 bangla"
              >
                নাম্বার পরিবর্তন করুন
              </button>
            </div>
            <div className="space-y-2">
              <label htmlFor="otp" className="block text-sm font-medium text-foreground-muted bangla">OTP কোড</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-foreground-muted" />
                </div>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="block w-full pl-10 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-foreground sm:text-sm tracking-widest text-center transition-all"
                  placeholder="000000"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !otp}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all bangla"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ভেরিফাই করুন"}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary hover:text-primary-hover font-medium transition-colors bangla">
            ইমেইল দিয়ে লগইন করুন
          </Link>
        </div>
      </div>
    </div>
  );
}
