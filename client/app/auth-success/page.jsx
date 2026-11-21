'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { handleGoogleCallback, getProfile } from '@/store/slices/userSlice';
import toast from 'react-hot-toast';

const AuthSuccess = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  
  // Use a ref to prevent double-dispatch in React Strict Mode
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const token = searchParams.get('token');
    const role = searchParams.get('role');

    if (token) {
      processedRef.current = true;
      
      const finalizeAuth = async () => {
        try {
          // 1. Sync Token/Role to Redux and LocalStorage
          // We construct a mock user object initially; getProfile will fill the rest
          const payload = {
            token,
            user: { role: role || 'customer' } 
          };

          await dispatch(handleGoogleCallback(payload));

          // 2. Fetch full profile details from backend using the new token
          await dispatch(getProfile()).unwrap();

          toast.success("Authentication Successful");
          
          // 3. Redirect to home or dashboard
          router.push('/');
        } catch (error) {
          console.error("Auth hydration failed:", error);
          toast.error("Failed to sync profile. Please login manually.");
          router.push('/login');
        }
      };

      finalizeAuth();
    } else {
      // If no token found in URL, redirect to login
      toast.error("Invalid authentication session");
      router.push('/login');
    }
  }, [searchParams, dispatch, router]);

  return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-8"
      >
        {/* Visual Feedback */}
        <div className="relative flex justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 border-t-4 border-b-4 border-primary rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black tracking-tighter text-base-content">
            Securing Session...
          </h2>
          <p className="text-base-content/60 font-medium">
            Verifying your identity and synchronizing your medical portal profile.
          </p>
        </div>

        {/* Loading Steps */}
        <div className="bg-base-200 rounded-3xl p-6 border border-base-300 text-left space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-success w-5 h-5" />
            <span className="text-sm font-bold opacity-100">Token Received</span>
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-primary w-5 h-5" />
            <span className="text-sm font-bold opacity-70">Hydrating User Profile...</span>
          </div>
        </div>

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-base-content/20">
          Likeson Healthcare Secure Gateway
        </p>
      </motion.div>
    </div>
  );
};

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base-100 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
      <AuthSuccess />
    </Suspense>
  );
}