import Link from "next/link";
import type { ReactNode } from "react";
import "@/app/legal.css";
import { Logo } from "@/components/brand/Logo";

const SITE_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/community-guidelines", label: "Community Guidelines" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/credits", label: "Credits" }
] as const;

type LegalPageProps = {
  title: string;
  path: (typeof SITE_LINKS)[number]["href"];
  updated: string;
  children: ReactNode;
};

export function LegalPage({ title, path, updated, children }: LegalPageProps) {
  return (
    <div className="legal-page">
      <header className="legal-nav">
        <Logo />
        <nav className="legal-nav-links" aria-label="Site">
          {SITE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === path ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        {children}
      </main>

      <footer className="legal-footer">
        <span>Rhoq Fitness</span>
        <Link href="/rooms">Rooms</Link>
        <Link href="/feed">Feed</Link>
        {SITE_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </footer>
    </div>
  );
}
