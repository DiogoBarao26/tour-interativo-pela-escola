export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="field font-semibold" />;
}

export function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="field min-h-28 font-semibold" />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="field font-semibold" />;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 font-bold">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" />
      {label}
    </label>
  );
}

export function Notice({ error, message }: { error?: string | null; message?: string | null }) {
  if (!error && !message) return null;
  return <p role={error ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 font-semibold ${error ? 'bg-red-50 text-red-900' : 'bg-white'}`}>{error || message}</p>;
}
