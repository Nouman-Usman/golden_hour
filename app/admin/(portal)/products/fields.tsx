// Shared input styles for admin forms (server-renderable).
export const input =
  "w-full border-b border-ash/60 bg-transparent py-2 text-bone placeholder:text-ash focus:border-brass-light focus:outline-none";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-ash">{label}</span>
      {children}
    </label>
  );
}
