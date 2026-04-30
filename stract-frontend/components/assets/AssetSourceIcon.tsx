import { Link, File, FileText, Image } from 'lucide-react';
import type { SourceType } from '@/types';

function GDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.1c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="M43.65 25l-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.3 43.8a9.06 9.06 0 00-1.2 4.5h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
      <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L7.2 5.65 43.65 25z" fill="#00832d" />
      <path d="M59.8 53H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.8c1.55 0 3.1-.4 4.5-1.2L59.8 53z" fill="#2684fc" />
      <path d="M73.4 26.5l-12.65-21.9c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28H87.3c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function FigmaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 57" aria-hidden="true">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1abcfe" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0acf83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#ff7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#f24e1e" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#a259ff" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" fill="currentColor" />
    </svg>
  );
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zm-12.68-2.104L20.462 4.93c.56-.047.7.28.7.56v13.72c0 .42-.14.794-.981.84l-14.477.84c-.7.047-.981-.186-.981-.793V6.4c0-.467.234-.934.653-.98z" fill="currentColor" />
    </svg>
  );
}

interface AssetSourceIconProps {
  sourceType: SourceType | 'file';
  mimeType?: string | null;
  className?: string;
  size?: number;
}

export function AssetSourceIcon({ sourceType, mimeType, className = '', size = 16 }: AssetSourceIconProps) {
  const iconCls = `${className}`;

  if (sourceType === 'file') {
    if (mimeType?.startsWith('image/')) return <Image size={size} className={`text-green-600 ${iconCls}`} />;
    if (mimeType === 'application/pdf' || mimeType?.includes('word') || mimeType?.includes('document')) {
      return <FileText size={size} className={`text-red-500 ${iconCls}`} />;
    }
    return <File size={size} className={`text-gray-500 ${iconCls}`} />;
  }

  if (sourceType === 'gdrive') return <GDriveIcon className={`h-4 w-4 ${iconCls}`} />;
  if (sourceType === 'figma') return <FigmaIcon className={`h-4 w-4 ${iconCls}`} />;
  if (sourceType === 'github') return <GitHubIcon className={`h-4 w-4 text-gray-800 ${iconCls}`} />;
  if (sourceType === 'notion') return <NotionIcon className={`h-4 w-4 text-gray-800 ${iconCls}`} />;

  return <Link size={size} className={`text-indigo-500 ${iconCls}`} />;
}
