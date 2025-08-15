'use client';
export default function UpgradeModal({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-semibold mb-2">Free tier limit reached</h2>
        <p className="text-sm mb-4">Upgrade to enable more checks and paid-tier features.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
          <a href="/pricing" className="px-3 py-1 rounded bg-black text-white">See pricing</a>
        </div>
      </div>
    </div>
  );
}
