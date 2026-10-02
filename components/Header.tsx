"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, Search, Settings, LogOut, User as UserIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  onSearch?: (query: string) => void;
  userEmail?: string;
}

export function Header({ onSearch, userEmail }: HeaderProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/files" className="flex items-center gap-2 flex-shrink-0 group">
          <div className="w-8 h-8 bg-neutral-900 rounded-md flex items-center justify-center group-hover:bg-neutral-800 transition-colors">
            <Cloud className="text-white w-5 h-5" />
          </div>
          <span className="font-semibold text-neutral-900 hidden sm:block tracking-tight">BASED CLOUD</span>
        </Link>

        {pathname === "/files" && onSearch ? (
          <div className="flex-1 max-w-xl relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-neutral-400" />
            </div>
            <input
              type="text"
              placeholder="Search files..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-md bg-neutral-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition-colors"
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 transition-colors"
          >
            <UserIcon className="w-4 h-4" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-4 top-14 mt-1 w-56 bg-white rounded-md shadow-lg border border-neutral-200 py-1">
              {userEmail && (
                <div className="px-4 py-2 border-b border-neutral-100 mb-1">
                  <p className="text-sm font-medium text-neutral-900 truncate">{userEmail}</p>
                </div>
              )}
              <Link
                href="/files"
                className="flex items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                onClick={() => setDropdownOpen(false)}
              >
                <Cloud className="w-4 h-4 mr-2" /> My Files
              </Link>
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                onClick={() => setDropdownOpen(false)}
              >
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Link>
              <form action="/auth/signout" method="post" className="w-full mt-1 border-t border-neutral-100">
                <button
                  type="submit"
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
