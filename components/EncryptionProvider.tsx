"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface EncryptionContextType {
  mek: CryptoKey | null;
  setMek: (key: CryptoKey | null) => void;
  lockVault: () => void;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [mek, setMek] = useState<CryptoKey | null>(null);

  const lockVault = () => {
    setMek(null);
  };

  return (
    <EncryptionContext.Provider value={{ mek, setMek, lockVault }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
}
