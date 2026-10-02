"use server";

import { createClient } from "./supabase/server";
import { MAX_USER_STORAGE_BYTES } from "./constants";

export async function getUserStorageUsage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: files, error } = await supabase
    .from("files")
    .select("size_bytes")
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Failed to fetch storage usage");
  }

  return files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
}

export async function checkQuota(newUploadSizeBytes: number) {
  const currentUsage = await getUserStorageUsage();
  
  if (currentUsage + newUploadSizeBytes > MAX_USER_STORAGE_BYTES) {
    return {
      allowed: false,
      currentUsage,
      message: `This upload would exceed your 250 MB storage limit. You have ${formatMB(MAX_USER_STORAGE_BYTES - currentUsage)} remaining.`
    };
  }

  return { allowed: true, currentUsage };
}

function formatMB(bytes: number) {
  return `${Math.max(0, bytes / (1024 * 1024)).toFixed(1)} MB`;
}
