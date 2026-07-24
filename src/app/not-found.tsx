import Link from "next/link";
import "@/app/landing.css";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="not-found">
      <Logo showMark={false} />
      <p className="not-found-code">404</p>
      <h1>This page missed today&apos;s workout</h1>
      <p className="not-found-sub">You should not</p>
      <Link className="btn-primary" href="/rooms">
        Work Out
      </Link>
    </main>
  );
}
