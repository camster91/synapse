"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  const handleLogin = async (data: {
    email: string;
    password: string;
  }) => {
    setError("");
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error === "CredentialsSignin"
        ? "Invalid email or password"
        : result.error);
      return;
    }

    if (result?.ok) {
      router.push("/");
    }
  };

  return (
    <AuthForm
      mode="login"
      onSubmit={handleLogin}
      onGoogleAuth={() => signIn("google", { callbackUrl: "/" })}
      onGithubAuth={() => signIn("github", { callbackUrl: "/" })}
      error={error}
    />
  );
}