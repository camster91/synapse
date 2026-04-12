"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  const handleRegister = async (data: {
    email: string;
    password: string;
    name?: string;
  }) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.message || "Registration failed");
        return;
      }

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.ok) {
        router.push("/");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <AuthForm
      mode="register"
      onSubmit={handleRegister}
      onGoogleAuth={() => signIn("google", { callbackUrl: "/" })}
      onGithubAuth={() => signIn("github", { callbackUrl: "/" })}
      error={error}
    />
  );
}