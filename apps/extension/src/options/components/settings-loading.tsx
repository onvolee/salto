import { Separator } from "salto-src/components/ui/separator";
import { Skeleton } from "salto-src/components/ui/skeleton";

export function SettingsLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="正在加载设置"
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-5 py-8 sm:px-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <Separator />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </main>
  );
}
