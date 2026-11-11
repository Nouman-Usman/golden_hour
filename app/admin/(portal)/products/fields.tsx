// Shared input styles for admin forms (server-renderable).
export const input =
  "mt-1.5 block w-full rounded-lg border border-line bg-matte px-3 py-2.5 text-bone placeholder:text-ash transition-colors focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/25";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-bone/80">{label}</span>
      {children}
    </label>
  );
}
