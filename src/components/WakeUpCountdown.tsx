import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface WakeUpCountdownProps {
  onReady: () => void;
  onGiveUp: () => void;
}

export function WakeUpCountdown({ onReady, onGiveUp }: WakeUpCountdownProps) {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<'server' | 'telegram' | 'ready' | 'failed'>('server');
  const stoppedRef = useRef(false);
  const readyCalledRef = useRef(false);
  const isCheckingRef = useRef(false);

  const callReady = useCallback(() => {
    if (!readyCalledRef.current && !stoppedRef.current) {
      readyCalledRef.current = true;
      stoppedRef.current = true;
      setPhase('ready');
      setTimeout(onReady, 800);
    }
  }, [onReady]);

  const checkHealth = useCallback(async () => {
    if (stoppedRef.current || isCheckingRef.current) return false;
    isCheckingRef.current = true;
    try {
      const backend = await api.getWorkingBackend();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 40000); // Wait up to 40s during wakeup
      const r = await fetch(`${backend}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const data = await r.json();
        if (data.telegram === 'connected' || data.telegram_secondary === 'connected') {
          callReady();
          isCheckingRef.current = false;
          return true;
        }
        if (data.status !== 'degraded' || data.session_set) {
          setPhase('telegram');
        }
      }
    } catch {
      setPhase('server');
    }
    isCheckingRef.current = false;
    return false;
  }, [callReady]);

  useEffect(() => {
    stoppedRef.current = false;
    readyCalledRef.current = false;

    // Trigger warmup immediately
    api.getWorkingBackend().then(backend => {
      fetch(`${backend}/api/warmup`).catch(() => {});
    });

    // First check immediately
    checkHealth();

    // Poll every 4 seconds
    const pollId = setInterval(checkHealth, 4000);

    // Elapsed timer
    const tickId = setInterval(() => {
      if (!stoppedRef.current) setElapsed(e => e + 1);
    }, 1000);

    // Give up after 90 seconds
    const giveUpId = setTimeout(() => {
      if (!stoppedRef.current && !readyCalledRef.current) {
        stoppedRef.current = true;
        clearInterval(pollId);
        clearInterval(tickId);
        setPhase('failed');
      }
    }, 90000);

    return () => {
      stoppedRef.current = true;
      clearInterval(pollId);
      clearInterval(tickId);
      clearTimeout(giveUpId);
    };
  }, [checkHealth]);

  const handleRetry = useCallback(async () => {
    stoppedRef.current = false;
    readyCalledRef.current = false;
    setElapsed(0);
    setPhase('server');
    // Trigger warmup
    api.getWorkingBackend().then(b => fetch(`${b}/api/warmup`).catch(() => {}));
    const ready = await checkHealth();
    if (!ready) {
      const id = setInterval(async () => {
        if (stoppedRef.current) { clearInterval(id); return; }
        const done = await checkHealth();
        if (done) clearInterval(id);
      }, 4000);
      setTimeout(() => { clearInterval(id); if (!stoppedRef.current) setPhase('failed'); }, 90000);
    }
  }, [checkHealth]);

  const dot = (active: boolean, index: number) => (
    <span key={index} className={`inline-block w-2 h-2 rounded-full mx-0.5 transition-all duration-300 ${active ? 'bg-indigo-400 scale-125' : 'bg-gray-700'}`} />
  );

  if (phase === 'failed') {
    return (
      <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center text-white z-20 rounded-xl p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="bangla text-lg font-bold text-red-400 mb-2">সংযোগ ব্যর্থ হয়েছে</h3>
        <p className="bangla text-gray-400 text-sm text-center mb-6 max-w-xs">
          ৯০ সেকেন্ডেও সার্ভার সংযুক্ত হয়নি। ইন্টারনেট সংযোগ চেক করুন।
        </p>
        <div className="flex gap-3">
          <button onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm bangla font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> আবার চেষ্টা
          </button>
          <button onClick={onGiveUp}
            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm bangla transition-colors">
            বাতিল
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center text-white z-20 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-green-900/50 flex items-center justify-center mb-3">
          <Wifi className="w-7 h-7 text-green-400" />
        </div>
        <p className="bangla text-green-400 font-bold">প্রস্তুত! শুরু হচ্ছে...</p>
      </div>
    );
  }

  const messages = {
    server:   { title: 'সার্ভার চালু হচ্ছে...', subtitle: 'রেন্ডার ফ্রি সার্ভার স্লিপ মোড থেকে জেগে উঠছে' },
    telegram: { title: 'টেলিগ্রামে সংযোগ হচ্ছে...', subtitle: 'ভিডিও স্ট্রিমিং সংযোগ তৈরি হচ্ছে' },
  };
  const msg = messages[phase] || messages.server;

  return (
    <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center text-white z-20 rounded-xl p-6">
      <div className="w-16 h-16 bg-indigo-900/50 rounded-full flex items-center justify-center mb-5 relative">
        <Wifi className="w-7 h-7 text-indigo-300" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-pulse" />
      </div>
      <h3 className="bangla text-lg font-bold text-amber-400 mb-2">{msg.title}</h3>
      <p className="bangla text-gray-400 text-sm text-center mb-5 max-w-xs">{msg.subtitle}</p>
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: 8 }, (_, i) => dot(i === Math.floor((elapsed % 8)), i))}
      </div>
      <p className="text-gray-500 text-xs bangla">{elapsed} সেকেন্ড... প্রতি ৪ সেকেন্ডে চেক হচ্ছে</p>
      {elapsed > 30 && (
        <p className="text-gray-600 text-xs bangla mt-1">সর্বোচ্চ ৯০ সেকেন্ড পর্যন্ত অপেক্ষা করবে</p>
      )}
    </div>
  );
}
