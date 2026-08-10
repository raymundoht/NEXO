import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import dynamic from "next/dynamic";

const LandingPage = dynamic(
  () => import("@/components/landing/landing-page").then((m) => ({ default: m.LandingPage })),
  { loading: () => <div className="min-h-screen bg-[var(--color-app)]" /> }
);

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <LandingPage />;
}
