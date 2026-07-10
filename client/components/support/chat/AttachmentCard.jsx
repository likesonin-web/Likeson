import { useState } from 'react';
import { FileText, FileSpreadsheet, Presentation, FileArchive, Download, Play, Maximize2 } from 'lucide-react';
import Dialog from '../shared/Dialog';

const DOC_ICON_BY_EXT = {
  doc: { icon: FileText, className: 'bg-info/10 text-info' },
  docx: { icon: FileText, className: 'bg-info/10 text-info' },
  xls: { icon: FileSpreadsheet, className: 'bg-success/10 text-success' },
  xlsx: { icon: FileSpreadsheet, className: 'bg-success/10 text-success' },
  csv: { icon: FileSpreadsheet, className: 'bg-success/10 text-success' },
  ppt: { icon: Presentation, className: 'bg-warning/10 text-warning' },
  pptx: { icon: Presentation, className: 'bg-warning/10 text-warning' },
  zip: { icon: FileArchive, className: 'bg-base-300/60 text-base-content/70' },
  txt: { icon: FileText, className: 'bg-base-300/60 text-base-content/70' },
};

function docIconFor(originalName) {
  const ext = originalName?.split('.').pop()?.toLowerCase();
  return DOC_ICON_BY_EXT[ext] || { icon: FileText, className: 'bg-error/10 text-error' };
}

/**
 * @param {{ attachment: {url: string, fileType: string, originalName: string, sizeBytes?: number, thumbnailUrl?: string} }} props
 */
export default function AttachmentCard({ attachment }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { url, fileType, originalName, sizeBytes, thumbnailUrl } = attachment;
  const sizeLabel = sizeBytes ? `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB` : '';

  if (fileType === 'image') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative block rounded-field overflow-hidden max-w-[240px] group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={originalName} className="w-full h-auto object-cover" loading="lazy" />
          <span className="absolute inset-0 bg-neutral/0 group-hover:bg-neutral/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Maximize2 className="w-5 h-5 text-white" />
          </span>
        </button>
        <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} title={originalName} size="xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={originalName} className="w-full h-auto rounded-field" />
        </Dialog>
      </>
    );
  }

  if (fileType === 'video') {
    return (
      <div className="relative rounded-field overflow-hidden max-w-[280px] bg-neutral">
        <video src={url} controls poster={thumbnailUrl} className="w-full h-auto" preload="metadata">
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (fileType === 'audio') {
    return (
      <div className="flex items-center gap-2 bg-base-200 rounded-field p-2.5 max-w-[280px]">
        <Play className="w-4 h-4 text-primary shrink-0" />
        <audio src={url} controls className="h-8 flex-1 min-w-0" />
      </div>
    );
  }

  // Documents (pdf, docx, xlsx, pptx, txt, csv, zip, ...)
  const { icon: DocIcon, className: docClassName } = docIconFor(originalName);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-base-200 rounded-field p-3 max-w-[280px] hover:bg-base-300/60 transition-colors"
    >
      <div className={`w-9 h-9 rounded-field flex items-center justify-center shrink-0 ${docClassName}`}>
        <DocIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{originalName}</p>
        {sizeLabel && <p className="text-[11px] text-base-content/40">{sizeLabel}</p>}
      </div>
      <Download className="w-4 h-4 text-base-content/40 shrink-0" />
    </a>
  );
}