"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2 } from 'lucide-react';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '@/lib/config';
import { Kode_Mono } from 'next/font/google';

const kodeMono = Kode_Mono({ 
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap'
});

const supabaseUrl = PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null as any;

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) return;
    
    setStatus('loading');
    
    try {
      if (supabase) {
        const { error } = await supabase
          .from('waitlist')
          .insert([{ email }])
          .select()
          .single();
          
        if (error) {
          if (error.message.includes('unique constraint')) {
            setError('You are already on the waitlist!');
          } else {
            throw error;
          }
        } else {
          setStatus('done');
        }
      } else {
        setStatus('done');
      }
    } catch (err) {
      console.error(err);
      setError('There was an error joining the waitlist. Please try again.');
      setStatus('error');
    }
  };

  // Hide header and footer on mount - force rebuild
  useEffect(() => {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    const main = document.querySelector('main');
    
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (main) {
      main.style.position = 'fixed';
      main.style.inset = '0';
      main.style.overflow = 'hidden';
    }
    
    // Cleanup function to restore on unmount
    return () => {
      if (header) header.style.display = '';
      if (footer) footer.style.display = '';
      if (main) {
        main.style.position = '';
        main.style.inset = '';
        main.style.overflow = '';
      }
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 w-full h-full overflow-hidden" 
      style={{ 
        backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\"0 0 1440 1024\" xmlns=\"http://www.w3.org/2000/svg\" preserveAspectRatio=\"none\"><g transform=\"matrix(4.4087e-15 51.2 -72 3.1351e-15 720 512)\" opacity=\"1\"><rect height=\"190\" width=\"190\" fill=\"url(%23grad)\" id=\"quad\" shape-rendering=\"crispEdges\"/><use href=\"%23quad\" transform=\"scale(1 -1)\"/><use href=\"%23quad\" transform=\"scale(-1 1)\"/><use href=\"%23quad\" transform=\"scale(-1 -1)\"/></g><defs><linearGradient id=\"grad\" gradientUnits=\"userSpaceOnUse\" x2=\"5\" y2=\"5\"><stop stop-color=\"rgba(54,109,134,1)\" offset=\"0\"/><stop stop-color=\"rgba(44,88,109,1)\" offset=\"0.063702\"/><stop stop-color=\"rgba(34,67,83,1)\" offset=\"0.1274\"/><stop stop-color=\"rgba(23,47,58,1)\" offset=\"0.19111\"/><stop stop-color=\"rgba(13,26,32,1)\" offset=\"0.25481\"/></linearGradient></defs></svg>')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Centered Content */}
      <div className="absolute left-1/2 transform -translate-x-1/2" style={{ top: "calc(50% - 150px)" }}>
        {/* ORIGO Logo - Centered and Larger */}
        <div className="text-center mb-8">
          <h1 className={`${kodeMono.className} font-bold text-[#e1a1a1] text-[72px] tracking-[18px]`}>
            ORIGO
          </h1>
        </div>

        {/* High Signal Idea Generation - Below ORIGO */}
        <p className={`${kodeMono.className} font-normal text-[40px] text-center text-white whitespace-nowrap`}>
          <span className="text-[#8de7d5]">High Signal</span>
          <span className="text-white"> Idea Generation</span>
        </p>
      </div>

      {/* Email Signup Form - Below Tagline */}
      <div className="absolute left-1/2 transform -translate-x-1/2" style={{ top: "calc(50% + 100px)", width: "400px" }}>
        {status === 'done' ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <Check className="w-12 h-12 text-[#8de7d5]" />
            </div>
            <h2 className={`text-xl font-semibold text-white mb-2 ${kodeMono.className}`}>You&apos;re on the list!</h2>
            <p className={`text-white/70 ${kodeMono.className}`}>Thanks for joining. We&apos;ll notify you when we launch.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-8">
            <p className={`text-white/70 mb-4 text-center text-sm ${kodeMono.className}`}>Level-up your investment process</p>
            <h2 className={`text-xl font-semibold text-white mb-6 text-center ${kodeMono.className}`}>Join the Waitlist</h2>
            
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-md p-3 mb-4">
                <p className={`text-red-200 text-sm ${kodeMono.className}`}>{error}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
                className={`h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[#8de7d5] focus:ring-[#8de7d5] ${kodeMono.className}`}
              />
              
              <Button
                type="submit"
                disabled={status === 'loading' || !email}
                className={`w-full h-11 bg-[#8de7d5] hover:bg-[#7dd5c4] text-gray-900 font-medium ${kodeMono.className}`}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Get Early Access'
                )}
              </Button>
            </div>
            
            <p className={`text-xs text-center text-white/50 mt-4 ${kodeMono.className}`}>
              No spam. We&apos;ll only send important updates.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
