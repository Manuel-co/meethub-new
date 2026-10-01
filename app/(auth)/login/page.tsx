import type { Metadata } from "next";
import AuthForm from "@/components/app/AuthForm";

export const metadata: Metadata = { title: "Log in · MeetHub" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
