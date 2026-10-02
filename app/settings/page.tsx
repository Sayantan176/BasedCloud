import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { formatBytes } from "@/lib/utils";
import { MAX_USER_STORAGE_BYTES } from "@/lib/constants";
import { HardDrive, User, LogOut } from "lucide-react";
import { SecuritySettings } from "@/components/SecuritySettings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Calculate storage usage
  const { data: files } = await supabase
    .from("files")
    .select("size_bytes");

  const totalSize = files?.reduce((acc, f) => acc + (f.size_bytes || 0), 0) || 0;
  const storagePercentage = Math.min((totalSize / MAX_USER_STORAGE_BYTES) * 100, 100);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header userEmail={user.email} />
      
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Account Section */}
          <section className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2 first:rounded-t-xl">
              <User className="w-4 h-4 text-neutral-500" />
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Account</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-sm font-medium text-neutral-500">Email</div>
                <div className="sm:col-span-2 text-sm text-neutral-900 font-medium">{user.email}</div>
                
                <div className="text-sm font-medium text-neutral-500">Account Status</div>
                <div className="sm:col-span-2 flex items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>
              <p className="mt-4 text-xs text-neutral-500 bg-neutral-50 p-3 rounded-md">
                User management is handled securely through the backend infrastructure.
              </p>
            </div>
          </section>

          {/* Application Section */}
          <section className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-2 first:rounded-t-xl">
              <HardDrive className="w-4 h-4 text-neutral-500" />
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Storage</h2>
            </div>
            <div className="p-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-900">
                  {formatBytes(totalSize)} used
                </span>
                <span className="text-sm text-neutral-500">
                  {formatBytes(MAX_USER_STORAGE_BYTES)} total
                </span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-neutral-900 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${storagePercentage}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-neutral-500 text-right">
                {formatBytes(MAX_USER_STORAGE_BYTES - totalSize)} available
              </div>
              
              <div className="mt-8 pt-6 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-sm font-medium text-neutral-500">Version</div>
                <div className="sm:col-span-2 text-sm text-neutral-900">1.0.0 (BASED CLOUD)</div>
              </div>
            </div>
          </section>

          <SecuritySettings userId={user.id} />

          {/* Sign Out Section */}
          <section className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900">Sign Out</h3>
                  <p className="text-sm text-neutral-500 mt-1">Securely end your current session and lock your vault.</p>
                </div>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
