"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.includes("@") || password.length < 8) {
      setError("E-posta ve parola bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    setLoading(false);

    if (!response.ok) {
      setError(response.status === 401 ? "E-posta veya parola hatalı." : "Oturum açılamadı.");
      return;
    }

    router.replace("/");
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="login-logo">Zyber Cart</div>
        <h1>Commerce OS</h1>
        <p>Central Admin runtime erişimi</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <h2>Giriş yap</h2>
        <label>
          E-posta
          <input
            autoComplete="email"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@commerceos.local"
          />
        </label>
        <label>
          Parola
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button disabled={loading} type="submit">
          {loading ? "Doğrulanıyor" : "Oturum aç"}
        </button>
      </form>
    </main>
  );
}
