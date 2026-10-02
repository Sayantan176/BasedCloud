"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Cloud, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEncryption } from "@/components/EncryptionProvider";
import { deriveKek, generateMek, wrapMek, unwrapMek, generateRandomBytes, bufferToBase64, base64ToBuffer } from "@/lib/crypto";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setMek } = useEncryption();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    try {
      const user = authData.user;
      
      // Fetch user's encrypted key material
      const { data: keyData, error: keyError } = await supabase
        .from('user_keys')
        .select('*')
        .eq('id', user.id)
        .single();

      if (keyError && keyError.code !== 'PGRST116') {
        throw keyError;
      }

      let mekToStore: CryptoKey;

      if (!keyData) {
        // FIRST TIME SETUP
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
        mekToStore = mek;
      } else {
        // UNLOCK EXISTING VAULT
        const salt = base64ToBuffer(keyData.salt);
        const kekIv = base64ToBuffer(keyData.kek_iv);
        const wrappedMek = base64ToBuffer(keyData.wrapped_mek);

        const kek = await deriveKek(password, salt);
        try {
          mekToStore = await unwrapMek(wrappedMek, kek, kekIv);
        } catch (_) {
          throw new Error("Invalid password for encryption vault. If you reset your password recently, your old encrypted files cannot be decrypted without your old password.");
        }
      }

      setMek(mekToStore);
      router.push("/files");
      router.refresh();
    } catch (err) {
      console.error("Encryption setup error:", err);
      // We log them out if vault unlock fails, because the app requires MEK to function
      await supabase.auth.signOut();
      setError(err instanceof Error ? err.message : "Failed to unlock vault.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-neutral-200 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center mb-4">
            <Cloud className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">BASED CLOUD</h1>
          <p className="text-sm text-neutral-500 mt-1">Your private document vault</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-neutral-700" htmlFor="password">
                Password
              </label>
              <a href="#" className="text-xs text-neutral-500 hover:text-neutral-900">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
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

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-neutral-900 hover:underline">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
