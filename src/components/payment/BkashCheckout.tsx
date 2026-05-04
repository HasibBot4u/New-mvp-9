import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface BkashCheckoutProps {
  planId: string;
  amount: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function BkashCheckout({ planId: _planId, amount, onSuccess, onCancel }: BkashCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");

  const handleStartPayment = async () => {
    setLoading(true);
    // Simulate real bKash API call
    setTimeout(() => {
      setLoading(false);
      setStep(2); // Ask for phone
    }, 1500);
  };

  const handlePhoneSubmit = () => {
    if (phone.length === 11) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(3); // Ask for OTP
      }, 1000);
    }
  };

  const handleOtpSubmit = () => {
    if (otp.length === 6) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(4); // Ask for PIN
      }, 1000);
    }
  };

  const handlePinSubmit = () => {
    if (pin.length > 3) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onSuccess?.();
      }, 2000);
    }
  };

  if (step === 1) {
    return (
      <Card className="max-w-md mx-auto bg-pink-600/5 border-pink-500/20">
        <CardHeader>
          <CardTitle className="text-xl text-center text-pink-500">Pay with bKash</CardTitle>
          <CardDescription className="text-center">Total Amount: BDT {amount}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Button 
            className="w-full bg-pink-600 hover:bg-pink-700 text-white" 
            onClick={handleStartPayment}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Proceed to Payment
          </Button>
          {onCancel && <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>}
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto border-pink-500/30 shadow-lg shadow-pink-500/10">
      <div className="bg-pink-600 p-4 text-center text-white rounded-t-xl">
        <h3 className="font-bold">bKash Payment</h3>
        <p className="text-sm opacity-90">NexusEdu - Invoice #BK-{Math.floor(Math.random()*10000)}</p>
        <p className="text-xl font-bold mt-2">৳ {amount}</p>
      </div>
      <CardContent className="pt-6 space-y-4">
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-center text-foreground-muted">Enter your bKash account number</p>
            <Input 
              type="text" 
              placeholder="01XXXXXXXXX" 
              className="text-center tracking-wider"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
            />
            <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white" onClick={handlePhoneSubmit} disabled={loading || phone.length !== 11}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirm"}
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-center text-foreground-muted">Enter the verification code sent to {phone}</p>
            <Input 
              type="text" 
              placeholder="bKash Verification Code" 
              className="text-center tracking-widest text-lg font-mono"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
            />
            <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white" onClick={handleOtpSubmit} disabled={loading || otp.length !== 6}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Verify"}
            </Button>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-center text-foreground-muted">Enter your bKash PIN to confirm payment</p>
            <Input 
              type="password" 
              placeholder="bKash PIN" 
              className="text-center text-lg tracking-[0.3em] font-mono"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={5}
            />
            <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white" onClick={handlePinSubmit} disabled={loading || pin.length < 4}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirm Payment"}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-black/20 flex justify-center py-3">
        <button className="text-xs text-foreground-muted hover:text-white" onClick={onCancel}>Close</button>
      </CardFooter>
    </Card>
  );
}
