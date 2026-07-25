import { AnimatedLogo } from "@/components/animated-logo";

export default function DashboardLoading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <AnimatedLogo size="lg" />
        <p className="text-sm font-medium text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
