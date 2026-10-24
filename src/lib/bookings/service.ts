import type { Service } from "@prisma/client";

export type ServiceStep = { name: string; durationMin: number };

/**
 * مدت‌زمان مؤثر یک خدمت:
 * اگر خدمت چندمرحله‌ای باشد (steps)، مجموع مدت مرحله‌ها ملاک است؛ در غیر این صورت durationMin.
 */
export function serviceDuration(service: Pick<Service, "durationMin" | "steps">): number {
  const steps = (service.steps as ServiceStep[] | null) ?? null;
  if (Array.isArray(steps) && steps.length > 0) {
    const total = steps.reduce((sum, s) => sum + (Number(s.durationMin) || 0), 0);
    if (total > 0) return total;
  }
  return service.durationMin;
}

/** قیمت مجموع چند خدمت (برای رزرو چند خدمت) */
export function servicesTotalDuration(services: Pick<Service, "durationMin" | "steps">[]): number {
  return services.reduce((sum, svc) => sum + serviceDuration(svc), 0);
}
