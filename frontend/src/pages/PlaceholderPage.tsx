import { Boxes, Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-medium text-blue-600">StockFlow Workspace</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>

        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          {description}
        </p>
      </section>

      <section className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
        <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
          <Boxes size={32} strokeWidth={1.6} />
        </div>

        <h2 className="mt-5 flex items-center gap-2 text-base font-semibold text-slate-800">
          <Construction size={18} className="text-amber-500" />
          Module foundation
        </h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          This module is part of the StockFlow workspace. Its interface and
          backend integration will be implemented in the next development
          stages.
        </p>
      </section>
    </div>
  );
}
