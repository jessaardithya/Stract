'use client';

import { Hexagon } from 'lucide-react';

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-[#fafaf8] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-violet-600 p-1.5 rounded-lg flex items-center justify-center text-white">
            <Hexagon size={20} className="fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">Stract</span>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-[#e4e4e0] shadow-sm p-8">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1 mb-8">{subtitle}</p>

          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="mt-6 text-center text-sm text-gray-600">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
