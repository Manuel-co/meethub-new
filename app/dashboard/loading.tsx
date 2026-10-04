import { DashboardPageSkeleton } from "@/components/app/Loader";

// Shown inside the dashboard shell (sidebar stays put) while a page loads
export default function Loading() {
  return <DashboardPageSkeleton />;
}
