import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12" aria-hidden="true">
      <div className="space-y-6 xl:col-span-8">
        <section className="surface-elevated p-6 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row">
            <Skeleton className="h-28 w-28 rounded-[var(--radius-soft)]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="mt-2 h-4 w-40" />
              <Skeleton className="mt-4 h-7 w-32 rounded-full" />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Skeleton className="h-[74px] w-full rounded-[var(--radius-control)]" />
                <Skeleton className="h-[74px] w-full rounded-[var(--radius-control)]" />
                <Skeleton className="h-[74px] w-full rounded-[var(--radius-control)]" />
              </div>
            </div>
          </div>
        </section>

        <section className="surface p-6">
          <Skeleton className="mb-5 h-11 w-80 rounded-[var(--radius-control)]" />
          <Skeleton className="h-6 w-56" />
          <SkeletonText className="mt-4" lines={4} />
          <Skeleton className="mt-6 h-5 w-32" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </section>
      </div>

      <aside className="xl:col-span-4">
        <section className="surface p-6">
          <Skeleton className="h-6 w-44" />
          <SkeletonText className="mt-3" lines={2} />
          <Skeleton className="mt-5 h-10 w-full rounded-[var(--radius-control)]" />
          <Skeleton className="mt-2.5 h-10 w-full rounded-[var(--radius-control)]" />
          <Skeleton className="mt-5 h-20 w-full rounded-[var(--radius-control)]" />
        </section>
      </aside>
    </div>
  );
}
