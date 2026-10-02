import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FilesClient } from "./FilesClient";

export default async function FilesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch initial files
  const { data: files } = await supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <FilesClient initialFiles={files || []} userEmail={user.email} />
    </div>
  );
}
