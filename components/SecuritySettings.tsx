"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Lock, Key, AlertTriangle } from "lucide-react";
import { deriveKek, wrapMek, unwrapMek, base64ToBuffer, bufferToBase64, generateRandomBytes } from "@/lib/crypto";
import { useEncryption } from "./EncryptionProvider";

export function SecuritySettings({ userId }: { userId: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { mek } = useEncryption();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    if (!mek) {
      setStatus({ type: 'error', message: "Vault is locked. Cannot change password safely." });
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      // 1. Verify current password by unwrapping the MEK (to ensure we can derive the new one properly and they know their password)
      const { data: keyData, error: keyError } = await supabase
        .from('user_keys')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (keyError) throw new Error("Encryption key not found.");

      const oldSalt = base64ToBuffer(keyData.salt);
      const oldKekIv = base64ToBuffer(keyData.kek_iv);
      const oldWrappedMek = base64ToBuffer(keyData.wrapped_mek);

      const oldKek = await deriveKek(currentPassword, oldSalt);
      try {
        await unwrapMek(oldWrappedMek, oldKek, oldKekIv);
      } catch (_) {
        throw new Error("Current password is incorrect.");
      }

      // 2. Change password with Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      // 3. Re-wrap the MEK with the new password
      const newSalt = generateRandomBytes(16);
      const newKekIv = generateRandomBytes(12);
      const newKek = await deriveKek(newPassword, newSalt);
      
      const newWrappedMek = await wrapMek(mek, newKek, newKekIv);

      const { error: dbError } = await supabase
        .from('user_keys')
        .update({
          salt: bufferToBase64(newSalt),
          kek_iv: bufferToBase64(newKekIv),
          wrapped_mek: bufferToBase64(newWrappedMek)
        })
        .eq('id', userId);

      if (dbError) throw new Error("Password updated, but failed to re-wrap encryption key.");

      setStatus({ type: 'success', message: "Password updated and encryption vault re-secured successfully." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-neutral-200">
      <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2 first:rounded-t-xl">
        <Shield className="w-4 h-4 text-neutral-500" />
        <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Security & Encryption</h2>
      </div>
      <div className="p-6 space-y-8">
        
        {/* Encryption Status */}
        <div>
          <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-600" />
            Client-side encryption: Enabled
          </h3>
          <p className="text-sm text-neutral-500 mt-2">
            Your documents are encrypted in your browser before being uploaded to cloud storage. 
            Your encryption key is <strong>never</strong> stored as a plaintext key on the server.
          </p>
          <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-md flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Important: Password Resets</p>
              <p>
                Your authentication password and encryption access are linked. If you permanently lose your password 
                and perform a forced email reset, your encrypted files may not be recoverable without the old password.
                Always change your password using the form below while you still remember it.
              </p>
            </div>
          </div>
        </div>

        <hr className="border-neutral-100" />

        {/* Password Change */}
        <div>
          <h3 className="text-sm font-medium text-neutral-900 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-neutral-500" />
            Change Password
          </h3>
          <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            
            {status && (
              <p className={`text-xs font-medium ${status.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {status.message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !mek}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-70"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

      </div>
    </section>
  );
}
