# BASED CLOUD

BASED CLOUD is a private, zero-knowledge document vault. It allows users to securely upload, manage, and download their personal documents using robust client-side encryption. The backend logic and storage are powered by Next.js and Supabase.

## Features

- **Secure Authentication:** Standard email/password authentication using Supabase.
- **Client-Side E2E Encryption:** Files are strictly encrypted in the browser before being uploaded.
- **Zero-Knowledge Architecture:** No master keys or plaintext encryption keys are stored on the server.
- **Strict Storage Quota:** Hardcoded 250 MB application-level quota per user.
- **User Isolation:** Comprehensive Row Level Security (RLS) ensures users cannot see or access other users' metadata or ciphertext.
- **Minimalist UI:** A clean, responsive interface powered by Tailwind CSS.

## Security Architecture

### Encryption
BASED CLOUD encrypts document contents client-side before uploading them to Supabase Storage. 

Supabase therefore stores encrypted file contents rather than the original plaintext documents. Decryption occurs entirely in the user's browser. 

The encryption architecture works as follows:
1. **Master Encryption Key (MEK):** A 256-bit AES-GCM key is randomly generated upon a user's first login. This key natively encrypts and decrypts all the user's files.
2. **Key Encryption Key (KEK):** A key is derived mathematically from the user's plaintext password and a random 16-byte salt using `PBKDF2-HMAC-SHA-256` (600,000 iterations). 
3. **Wrapping:** The KEK is used to encrypt (wrap) the MEK. Only the *wrapped* MEK is stored in the Supabase database.
4. **Session Volatility:** The MEK is decrypted exclusively in the browser's memory via React Context and is wiped upon page reload or logout. 

**Note on Metadata:** To maintain essential application functionality (like searching and UI rendering), certain metadata remains visible to the server and database administrators:
- Filename
- File size (encrypted size)
- MIME type
- Timestamps
- User identity

### Storage Quota
The application enforces a strict **250 MB per user** application-level storage quota. This limit dynamically calculates against the *encrypted* file size using a robust database trigger and a server-side pre-flight check, eliminating race conditions.

## Tech Stack

- **Frontend/Backend:** Next.js (App Router), React, Tailwind CSS
- **Database & Storage:** Supabase (PostgreSQL, Supabase Storage)
- **Cryptography:** Native Web Crypto API
- **Icons:** Lucide React

## Project Structure

```
app/
  login/         # Authentication login flow
  signup/        # User registration flow
  files/         # Main vault UI and client-side encryption logic
  settings/      # Password changes, key wrapping, and quota UI
components/      # Reusable UI elements (Header, Security Settings)
  EncryptionProvider.tsx # In-memory key management Context
lib/
  crypto/        # Web Crypto abstractions (AES-GCM, PBKDF2)
  supabase/      # SSR Auth and Middleware clients
```

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A [Supabase](https://supabase.com/) account and project.

### 1. Supabase Setup
You need a fresh Supabase project.

1. Find your **Project URL** and **anon/publishable key** in the Supabase Dashboard under `Project Settings > API`.
2. Ensure Email/Password Auth is enabled under `Authentication > Providers`.
3. In the Supabase SQL Editor, run the schema files provided in this repository (e.g., `database.sql` and `database_encryption.sql`) to set up the necessary tables, quotas, and RLS policies.
4. Create a **private** Supabase Storage bucket named `documents`. Ensure it has policies restricting `SELECT`, `INSERT`, `UPDATE`, and `DELETE` exclusively to the authenticated user owning the folder path.

### 2. Running Locally

Clone the repository and install dependencies:
```bash
git clone <repository_url>
cd based-cloud
npm install
```

Copy the example environment variables:
```bash
cp .env.example .env.local
```
*(On Windows: `copy .env.example .env.local`)*

Open `.env.local` and fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```
**Important:** Do NOT place your Supabase `service_role` (secret) key into `.env.local`. The application relies entirely on the safely scoped publishable key and user-level authentication.

Start the development server:
```bash
npm run dev
```

## Deployment

This project is optimized for deployment on **Vercel**. 
1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Add the exact same environment variables from your `.env.local` to your Vercel Project Settings (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
4. Deploy.

## Limitations & Security Notes

- **Password Resets:** Because true end-to-end security relies on the mathematical possession of the user's password to formulate the KEK, a forced email password-reset permanently destroys access to the encrypted files (unless the user can recall their old password to manually unwrap their MEK).
- **Client Trust:** Client-side encryption protects against database leaks or rogue storage administrators. It does not protect against a compromised client device or a maliciously altered frontend bundle. 
