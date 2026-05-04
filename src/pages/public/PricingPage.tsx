import React, { useState } from "react";
import { CheckCircle2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "forever",
    description: "Get started with limited access",
    features: ["Access to 3 free chapters", "480p video quality", "Community support"],
    limitations: true,
  },
  {
    id: "basic",
    name: "Basic",
    price: "199",
    period: "monthly",
    description: "Perfect for single subject focus",
    features: ["Access to all Physics", "720p video quality", "5 downloads/month", "Community support"],
    popular: false,
  },
  {
    id: "standard",
    name: "Standard",
    price: "349",
    period: "monthly",
    description: "Most popular for science students",
    features: ["Physics + Chemistry", "1080p video quality", "15 downloads/month", "Live classes", "Priority support"],
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "499",
    period: "monthly",
    description: "Complete access to all materials",
    features: ["All subjects", "1080p video quality", "Unlimited downloads", "Live classes", "1-on-1 doubt solving"],
    popular: false,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "4999",
    period: "once",
    description: "Pay once, access forever",
    features: ["Everything in Premium", "All future updates", "No recurring fees", "Direct mentor access"],
    popular: false,
  }
];

export default function PricingPage() {
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentCode) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login to use an enrollment code");
        setLoading(false);
        navigate("/login");
        return;
      }

      const res = await fetch("/api/v1/payments/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ code: enrollmentCode })
      });

      if (res.ok) {
        toast.success("Enrollment successful!");
        navigate("/student/dashboard");
      } else {
        const err = await res.json();
        toast.error(err.detail || "Invalid enrollment code");
      }
    } catch (error) {
      toast.error("Failed to process enrollment code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-16 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500 min-h-screen">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/20">Simple Pricing (Coming Soon)</Badge>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Choose the perfect plan for your studies</h1>
        <p className="text-lg text-foreground-muted">
          Direct payments are temporarily disabled while we add new payment gateways.
        </p>
      </div>

      <div className="max-w-md mx-auto mb-16">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              Have an Enrollment Code?
            </CardTitle>
            <CardDescription>Enter it below to unlock your plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnrollment} className="flex gap-2">
              <Input 
                placeholder="Enter code (e.g. VIP-2026)" 
                value={enrollmentCode}
                onChange={(e) => setEnrollmentCode(e.target.value)}
              />
              <Button type="submit" disabled={!enrollmentCode || loading}>
                Redeem
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
        {PLANS.map((plan) => (
          <Card 
            key={plan.id} 
            className={`flex flex-col border ${plan.popular ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-white/10 bg-black/40'} backdrop-blur-xl relative`}
          >
            {plan.popular && (
              <div className="absolute top-0 inset-x-0 transform -translate-y-1/2 flex justify-center">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Most Popular
                </span>
              </div>
            )}
            
            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription className="h-10">{plan.description}</CardDescription>
              <div className="mt-4 flex items-baseline text-4xl font-extrabold">
                <span className="text-lg font-medium text-foreground-muted mr-1">BDT</span>
                {plan.price}
                {plan.price !== "0" && <span className="ml-1 text-base font-medium text-foreground-muted">/{plan.period === "monthly" ? "mo" : "once"}</span>}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-4">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                    <span className="text-sm text-foreground-muted leading-tight">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant={plan.popular ? "default" : "outline"} 
                className={`w-full ${plan.popular ? '' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                disabled={plan.price !== "0"}
                onClick={() => {
                  if(plan.price === "0") navigate("/signup");
                }}
              >
                {plan.price === "0" ? "Start for Free" : `Coming Soon`}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
