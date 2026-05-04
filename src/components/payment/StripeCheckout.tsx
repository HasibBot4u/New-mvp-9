import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";

interface StripeCheckoutProps {
  planId: string;
  amount: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function StripeCheckout({ planId: _planId, amount, onSuccess, onCancel }: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleStripePayment = () => {
    setLoading(true);
    // In a real app we would load Stripe element or redirect to Stripe Checkout
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    }, 2000);
  };

  if (success) {
    return (
      <Card className="max-w-md mx-auto border-emerald-500/30">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-emerald-400">Payment Successful!</h3>
          <p className="text-foreground-muted">Redirecting to your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto border-indigo-500/20">
      <CardHeader>
        <CardTitle className="text-xl text-center text-indigo-400 flex items-center justify-center gap-2">
          <CreditCard className="w-5 h-5" /> Pay with Card (Stripe)
        </CardTitle>
        <CardDescription className="text-center">Total Amount: BDT {amount}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mock card input fields */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">Card Number</label>
          <Input placeholder="•••• •••• •••• ••••" className="font-mono bg-black/20" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-foreground-muted">Expiry</label>
            <Input placeholder="MM / YY" className="bg-black/20" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-foreground-muted">CVC</label>
            <Input placeholder="•••" className="bg-black/20" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
          onClick={handleStripePayment}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Pay BDT {amount}
        </Button>
        {onCancel && <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>}
      </CardFooter>
    </Card>
  );
}
