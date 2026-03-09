"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Upload,
  List,
  ShieldCheck,
  ScanText,
  FileAudio,
} from "lucide-react";
import { twMerge } from "tailwind-merge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/", label: "Hem", icon: <Home className="h-4 w-4" /> },
  {
    href: "/upload",
    label: "Ny transkription",
    icon: <Upload className="h-4 w-4" />,
  },
  {
    href: "/jobs",
    label: "Transkriptioner",
    icon: <List className="h-4 w-4" />,
  },
  {
    href: "/anonymize",
    label: "Anonymisera",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    href: "/ocr",
    label: "OCR",
    icon: <ScanText className="h-4 w-4" />,
  },
];

export function Navigation() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="bg-dark-900 border-b border-dark-800">
      <div className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <FileAudio className="h-6 w-6 text-primary-400 group-hover:text-primary-300 transition-colors" />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-primary-400 group-hover:text-primary-300 transition-colors">
              TystText
            </h1>
            <span className="text-sm text-gray-500 hidden sm:inline">
              Lokal svensk transkription
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={twMerge(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary-600/15 text-primary-400 border border-primary-600/30"
                    : "text-gray-400 hover:text-white hover:bg-dark-800 border border-transparent"
                )}
              >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
