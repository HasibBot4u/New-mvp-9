import React, { useState } from 'react';
import { Lock, CheckCircle, X } from 'lucide-react';
import { useChapterAccess } from '@/hooks/useChapterAccess';

interface EnrollmentCodeModalProps {
  isOpen: boolean;
  chapterId: string;
  chapterName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EnrollmentCodeModal({ isOpen, chapterId, chapterName, onClose, onSuccess }: EnrollmentCodeModalProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { submitCode } = useChapterAccess();

  if (!isOpen) return null;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const formatted = raw.match(/.{1,4}/g)?.join('-') || raw;
    setCode(formatted.substring(0, 29)); // 24 chars + 5 dashes
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length !== 24) {
      setErrorMsg('সঠিক ২৪ অক্ষরের কোড দিন');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const result = await submitCode(chapterId, code);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setCode('');
        onSuccess();
      }, 2000);
    } else {
      setErrorMsg(result.message_bn);
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          {isSuccess ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 bangla mb-2">অ্যাক্সেস দেওয়া হয়েছে!</h3>
              <p className="text-gray-600 bangla">খুলছে...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-indigo-600" />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 bangla mb-2">চ্যাপ্টার অ্যাক্সেস কোড</h2>
              <p className="text-gray-600 bangla mb-6">এই চ্যাপ্টারটি অ্যাক্সেস করতে একটি এনরোলমেন্ট কোড দিন</p>
              
              <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium bangla mb-6 w-full">
                {chapterName}
              </div>

              <form onSubmit={handleSubmit} className="w-full">
                <div className="mb-6">
                  <input
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    className="w-full font-mono text-center text-lg tracking-widest px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none"
                    disabled={isSubmitting}
                  />
                </div>

                {errorMsg && (
                  <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm bangla">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || code.replace(/[^A-Z0-9]/gi, '').length !== 24}
                  className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bangla flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'কোড দিয়ে অ্যাক্সেস নিন'
                  )}
                </button>
              </form>

              <p className="mt-6 text-xs text-gray-500 bangla">
                এই কোডটি শুধুমাত্র এই ডিভাইসে কাজ করবে। অন্য ডিভাইসে নতুন কোড লাগবে।
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
