"use client";

import { X } from "lucide-react";

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-dark/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-cream rounded-sm shadow-xl w-full ${wide ? "max-w-[640px]" : "max-w-[440px]"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD2] sticky top-0 bg-cream">
          <div className="font-display text-[14px] text-dark">{title}</div>
          <button onClick={onClose} className="text-charcoal hover:text-dark">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
