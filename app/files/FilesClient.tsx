"use client";

import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { createClient } from "@/lib/supabase/client";
import { 
  FileIcon, FileText, FileSpreadsheet, FileImage, 
  MoreVertical, Download, Trash2, Upload, Loader2, AlertCircle, Lock 
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

import { MAX_USER_STORAGE_BYTES } from "@/lib/constants";
import { checkQuota } from "@/lib/actions";
import { useEncryption } from "@/components/EncryptionProvider";
import { encryptFile, decryptFile, deriveKek, unwrapMek, base64ToBuffer } from "@/lib/crypto";

// ... existing code ...
type FileRecord = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  is_encrypted: boolean;
};

// ... existing getFileIcon and ALLOWED_MIME_TYPES ...
const getFileIcon = (mimeType: string) => {
  if (mimeType.includes("pdf")) return <FileText className="w-8 h-8 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel")) return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
  if (mimeType.includes("image")) return <FileImage className="w-8 h-8 text-blue-500" />;
  if (mimeType.includes("document") || mimeType.includes("word")) return <FileText className="w-8 h-8 text-blue-600" />;
  return <FileIcon className="w-8 h-8 text-neutral-400" />;
};

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv"
];

export function FilesClient({ initialFiles, userEmail }: { initialFiles: FileRecord[], userEmail?: string }) {
  const [files, setFiles] = useState<FileRecord[]>(initialFiles);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  const { mek, setMek } = useEncryption();
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const supabase = createClient();

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalSize = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
  const storagePercentage = Math.min((totalSize / MAX_USER_STORAGE_BYTES) * 100, 100);
  const isStorageFull = totalSize >= MAX_USER_STORAGE_BYTES;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: keyData, error: keyError } = await supabase
        .from('user_keys')
        .select('*')
        .eq('id', user.id)
        .single();

      if (keyError) throw new Error("Encryption key not found. Please log out and back in.");

      const salt = base64ToBuffer(keyData.salt);
      const kekIv = base64ToBuffer(keyData.kek_iv);
      const wrappedMek = base64ToBuffer(keyData.wrapped_mek);

      const kek = await deriveKek(unlockPassword, salt);
      const unlockedMek = await unwrapMek(wrappedMek, kek, kekIv);
      setMek(unlockedMek);
    } catch (err) {
      console.error(err);
      setUnlockError("Incorrect password or unlock failed.");
    } finally {
      setUnlocking(false);
    }
  };

  if (!mek) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-neutral-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Vault Locked</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Your files are protected with end-to-end encryption. Please enter your password to decrypt your vault.
          </p>
          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            {unlockError && <p className="text-xs text-red-600 font-medium">{unlockError}</p>}
            <button
              type="submit"
              disabled={unlocking}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-70"
            >
              {unlocking ? "Unlocking..." : "Unlock Vault"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleUploadClick = () => {
    if (isStorageFull) {
      setUploadError("Your storage is full. Delete some files to upload new documents.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const filesArray = Array.from(selectedFiles);
      let totalUploadSize = 0;
      const predictedEncryptedSizes: number[] = [];

      for (const file of filesArray) {
        if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
          throw new Error(`Unsupported file type: ${file.name}. Documents only.`);
        }
        // Encrypted size: version(1) + iv(12) + auth tag(16) + original size
        const encryptedSize = file.size + 29;
        predictedEncryptedSizes.push(encryptedSize);
        totalUploadSize += encryptedSize;
      }

      // Fast client-side check
      if (totalSize + totalUploadSize > MAX_USER_STORAGE_BYTES) {
        throw new Error(`This upload would exceed your 250 MB storage limit. You have ${formatBytes(MAX_USER_STORAGE_BYTES - totalSize)} remaining.`);
      }

      // Strict server-side check
      const quotaCheck = await checkQuota(totalUploadSize);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let updatedFiles = [...files];

      // Upload files sequentially
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        let fileNameToUpload = file.name;
        const isDuplicate = updatedFiles.some(f => f.name === file.name);
        
        if (isDuplicate) {
          const parts = file.name.split('.');
          const ext = parts.length > 1 ? `.${parts.pop()}` : '';
          fileNameToUpload = `${parts.join('.')}_${new Date().getTime()}${ext}`;
        }

        const storagePath = `${user.id}/${fileNameToUpload}`;

        // ENCRYPT THE FILE CLIENT-SIDE
        const encryptedBlob = await encryptFile(file, mek);

        // Upload the ciphertext to Supabase
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, encryptedBlob, { upsert: true });

        if (uploadError) throw uploadError;

        // Save metadata including is_encrypted: true
        const { data: dbData, error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: user.id,
            name: fileNameToUpload,
            storage_path: storagePath,
            mime_type: file.type,
            size_bytes: encryptedBlob.size, // QUOTA IS BASED ON ENCRYPTED SIZE
            is_encrypted: true
          })
          .select()
          .single();

        if (dbError) throw dbError;

        if (dbData) {
          updatedFiles = [dbData, ...updatedFiles];
        }
      }
      
      setFiles(updatedFiles);
    } catch (error) {
      console.error("Detailed upload error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(file.storage_path, 60);

      if (error) throw error;
      
      let blobUrl = data.signedUrl;
      let finalBlob: Blob | null = null;

      if (file.is_encrypted) {
        if (!mek) throw new Error("Vault is locked. Cannot decrypt.");
        
        // Fetch the ciphertext
        const res = await fetch(data.signedUrl);
        if (!res.ok) throw new Error("Failed to download encrypted file");
        
        const encryptedBlob = await res.blob();
        finalBlob = await decryptFile(encryptedBlob, mek, file.mime_type);
        blobUrl = URL.createObjectURL(finalBlob);
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup memory
      if (finalBlob) {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download or decrypt file.");
    }
    setActiveMenu(null);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([fileToDelete.storage_path]);

      if (storageError) throw storageError;

      // 2. Delete from DB
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileToDelete.id);

      if (dbError) throw dbError;

      setFiles(files.filter(f => f.id !== fileToDelete.id));
    } catch (error) {
      console.error("Delete failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to delete file. Reason: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  return (
    <>
      <Header onSearch={setSearchQuery} userEmail={userEmail} />
      
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">My Files</h1>
            <p className="text-sm text-neutral-500 mt-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-neutral-400" /> Files are encrypted before upload.
            </p>
            
            <div className="mt-4 flex flex-col gap-2 max-w-xs">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-neutral-900">{formatBytes(totalSize)} / {formatBytes(MAX_USER_STORAGE_BYTES)} used</span>
                <span className="text-neutral-500">{Math.round(storagePercentage)}% used</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-500 ${isStorageFull ? 'bg-red-500' : 'bg-neutral-900'}`}
                  style={{ width: `${storagePercentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-neutral-500">
                {formatBytes(MAX_USER_STORAGE_BYTES - totalSize)} remaining
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4 sm:mt-0 items-start">
            <input 
              type="file" 
              multiple
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept={ALLOWED_MIME_TYPES.join(", ")} 
            />
            
            <button
              onClick={handleUploadClick}
              disabled={isUploading || isStorageFull}
              className="flex items-center justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload</>
              )}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-800">{uploadError}</div>
            <button onClick={() => setUploadError(null)} className="text-red-600 hover:text-red-800 font-medium text-sm">
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
          {filteredFiles.length > 0 ? (
            <div className="divide-y divide-neutral-100">
              {/* Desktop Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                <div className="col-span-6">Name</div>
                <div className="col-span-2 text-right">Size</div>
                <div className="col-span-3 text-right">Uploaded</div>
                <div className="col-span-1 text-right"></div>
              </div>
              
              {/* File List */}
              {filteredFiles.map((file) => (
                <div key={file.id} className="relative group p-4 hover:bg-neutral-50 transition-colors flex flex-col md:grid md:grid-cols-12 md:gap-4 md:items-center">
                  
                  <div className="flex items-center gap-3 col-span-6 overflow-hidden mb-2 md:mb-0">
                    <div className="flex-shrink-0 bg-neutral-100 p-2 rounded-lg">
                      {getFileIcon(file.mime_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        {file.is_encrypted ? (
                          <span title="End-to-end encrypted">
                            <Lock className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800" title="Legacy unencrypted file. Download and re-upload to encrypt.">
                            Unencrypted
                          </span>
                        )}
                      </div>
                      <p suppressHydrationWarning className="text-xs text-neutral-500 md:hidden mt-0.5">
                        {formatBytes(file.size_bytes)} • {new Date(file.created_at).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block col-span-2 text-right text-sm text-neutral-600">
                    {formatBytes(file.size_bytes)}
                  </div>

                  <div suppressHydrationWarning className="hidden md:block col-span-3 text-right text-sm text-neutral-600">
                    {new Date(file.created_at).toLocaleDateString("en-US")}
                  </div>

                  <div className="absolute right-4 top-4 md:static md:col-span-1 md:text-right">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => setActiveMenu(activeMenu === file.id ? null : file.id)}
                        className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {activeMenu === file.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                            <div className="py-1" role="menu">
                              <button
                                onClick={() => handleDownload(file)}
                                className="flex w-full items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                              >
                                <Download className="w-4 h-4 mr-2" /> Download
                              </button>
                              <button
                                onClick={() => {
                                  setFileToDelete(file);
                                  setActiveMenu(null);
                                }}
                                className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                <FileIcon className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900">No files found</h3>
              <p className="text-sm text-neutral-500 mt-1 max-w-sm">
                {searchQuery ? "Try adjusting your search query." : "Upload your first document to get started."}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleUploadClick}
                  className="mt-6 text-sm font-medium text-neutral-900 hover:underline"
                >
                  Click here to upload
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-neutral-900/50 transition-opacity z-0" onClick={() => !isDeleting && setFileToDelete(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-neutral-900" id="modal-title">
                      Delete document?
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-neutral-500">
                        This will permanently remove <span className="font-semibold">{fileToDelete.name}</span>. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isDeleting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-70"
                  onClick={confirmDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-neutral-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setFileToDelete(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
