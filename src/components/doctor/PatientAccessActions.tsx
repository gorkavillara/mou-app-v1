'use client';

import { Check, Copy, Printer } from 'lucide-react';
import { useState } from 'react';

export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select-and-prompt is overkill; silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg"
    >
      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
      {copied ? 'Copiado' : 'Copiar URL'}
    </button>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg"
    >
      <Printer size={16} />
      Imprimir
    </button>
  );
}
