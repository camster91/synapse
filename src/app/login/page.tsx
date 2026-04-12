"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = async (data: {
    email: string;
    password: string;
  }) => {
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
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
    />
  );
}