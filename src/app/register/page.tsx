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
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        const message = err.message || "Registration failed";

        // Map common server errors to user-friendly messages
        if (message.toLowerCase().includes("already") || message.toLowerCase().includes("exists") || message.toLowerCase().includes("unique")) {
          setError("An account with this email already exists");
        } else if (message.toLowerCase().includes("password") || message.toLowerCase().includes("short") || message.toLowerCase().includes("weak") || message.toLowerCase().includes("8")) {
          setError("Password must be at least 8 characters");
        } else if (message.toLowerCase().includes("email") || message.toLowerCase().includes("invalid")) {
          setError("Please enter a valid email address");
        } else if (message.toLowerCase().includes("name") || message.toLowerCase().includes("required")) {
          setError("Name is required");
        } else {
          setError(message);
        }
        return;
      }

      // Auto sign in after successful registration
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        // Registration succeeded but auto-login failed; redirect to login
        router.push("/login");
        return;
      }

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