import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Download, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("subscription");

  // Mock data
  const currentPlan = {
    name: "Standard",
    status: "active",
    amount: "349 BDT",
    renewalDate: "June 4, 2026",
    paymentMethod: "bKash (ending in 8004)"
  };

  const invoices = [
    { id: "INV-2026-05", date: "May 4, 2026", amount: "349 BDT", status: "Paid", pdf: "#" },
    { id: "INV-2026-04", date: "Apr 4, 2026", amount: "349 BDT", status: "Paid", pdf: "#" }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 min-h-screen pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-foreground-muted mt-2">Manage your study plans, view payment history, and redeem codes.</p>
      </div>

      <div className="flex border-b border-white/10 mb-6">
        <button 
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'subscription' ? 'border-primary text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
          onClick={() => setActiveTab('subscription')}
        >
          Subscription
        </button>
        <button 
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invoices' ? 'border-primary text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
          onClick={() => setActiveTab('invoices')}
        >
          Payment History
        </button>
        <button 
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'redeem' ? 'border-primary text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
          onClick={() => setActiveTab('redeem')}
        >
          Redeem Code
        </button>
      </div>

      {activeTab === 'subscription' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-surface/40 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    {currentPlan.name} Plan
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                  </CardTitle>
                  <CardDescription className="mt-2">Your subscription is active and will auto-renew on {currentPlan.renewalDate}.</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{currentPlan.amount}</div>
                  <div className="text-xs text-foreground-muted">per month</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground-muted flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment Method</span>
                  <span className="font-medium">{currentPlan.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground-muted">Usage (Downloads)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[40%] rounded-full"></div>
                    </div>
                    <span className="font-medium text-xs">6 / 15</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-white/5 pt-4">
              <Button variant="outline" className="text-destructive hover:text-destructive border-white/10 hover:bg-destructive/10">Cancel Subscription</Button>
              <Button>Upgrade to Premium</Button>
            </CardFooter>
          </Card>

          <Card className="bg-black/40 border-primary/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Need more?</CardTitle>
              <CardDescription>Upgrade to Premium for unlimited downloads and live classes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-foreground-muted">
                <li className="flex items-center gap-2">✓ All subjects (Math, Bio)</li>
                <li className="flex items-center gap-2">✓ Unlimited offline downloads</li>
                <li className="flex items-center gap-2">✓ 1-on-1 doubt solving</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="default" onClick={() => window.location.href='/pricing'}>View Plans</Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {activeTab === 'invoices' && (
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Past payments and billing receipts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-foreground-muted" />
                    </div>
                    <div>
                      <p className="font-medium">{inv.amount} <span className="text-xs text-foreground-muted ml-2">{inv.id}</span></p>
                      <p className="text-xs text-foreground-muted mt-0.5">{inv.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{inv.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground-muted hover:text-foreground">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'redeem' && (
        <Card className="max-w-md bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Redeem Code</CardTitle>
            <CardDescription>Have an enrollment code from a teacher or promo?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter your 12-digit code</label>
              <Input placeholder="NEXUS-XXXXXX" className="h-11 bg-black/40 text-lg tracking-widest font-mono" />
            </div>
            <Button className="w-full h-11">Redeem Access</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
