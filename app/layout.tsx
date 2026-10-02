import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

import { EncryptionProvider } from "@/components/EncryptionProvider";

export const metadata: Metadata = {
  title: "BASED CLOUD",
  description: "Private document vault with client-side encryption",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-50 text-neutral-900 antialiased`}>
        <EncryptionProvider>
          {children}
        </EncryptionProvider>
      </body>
    </html>
  );
}
