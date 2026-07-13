import { Suspense } from "react";
import { LoginPage } from "@/components/auth/LoginPage";
import "@/app/login.css";

export const metadata = {
  title: "Sign in — Satara",
  description: "Sign in to Satara with Google or email to join live workout rooms."
};

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="login-page">
          <main className="login-stage">
            <p className="login-subheading">Loading…</p>
          </main>
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
