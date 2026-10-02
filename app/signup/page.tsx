"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Cloud, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEncryption } from "@/components/EncryptionProvider";
import { deriveKek, generateMek, wrapMek, generateRandomBytes, bufferToBase64 } from "@/lib/crypto";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { setMek } = useEncryption();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedEmail = email.trim();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (authError) {
      // Handle user-already-exists gracefully if exposed
      if (authError.message.toLowerCase().includes("user already registered") || authError.status === 422) {
        setError("An account may already exist with this email. Try signing in instead.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // Check if auto-login happened (meaning email confirmation is disabled)
    if (authData.session && authData.user) {
      try {
        const user = authData.user;
        
        // FIRST TIME ENCRYPTION SETUP
        const newSalt = generateRandomBytes(16);
        const newKekIv = generateRandomBytes(12);
        
        const kek = await deriveKek(password, newSalt);
        const mek = await generateMek();
        const wrappedMek = await wrapMek(mek, kek, newKekIv);

        const { error: insertError } = await supabase
          .from('user_keys')
          .insert({
            id: user.id,
            salt: bufferToBase64(newSalt),
            wrapped_mek: bufferToBase64(wrappedMek),
            kek_iv: bufferToBase64(newKekIv)
          });

        if (insertError) throw insertError;
        
        setMek(mek);
        router.push("/files");
        router.refresh();
      } catch (err) {
        console.error("Encryption initialization error:", err);
        await supabase.auth.signOut();
        setError("Account created, but encryption setup failed. Please try logging in.");
        setLoading(false);
      }
    } else {
      // Email confirmation is required
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-neutral-200 p-8 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Cloud className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Check your email</h2>
          <p className="text-sm text-neutral-500 mb-6">
            We&apos;ve sent a confirmation link to <span className="font-medium text-neutral-900">{email}</span>.
            Confirm your email to activate your BASED CLOUD account.
          </p>
          <Link 
            href="/login"
            className="w-full flex justify-center py-2.5 px-4 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-neutral-200 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center mb-4">
            <Cloud className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Create your account</h1>
          <p className="text-sm text-neutral-500 mt-1">Your private document vault</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 sm:text-sm transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="confirmPassword">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 focus:outline-none"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors mt-6",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
