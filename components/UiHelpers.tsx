import { InformationCircleIcon, LinkIcon, ChatBubbleLeftRightIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

export function InputTypeIcon({ type }: { type: 'link' | 'claim' | 'media' }) {
  if (type === 'link') return <LinkIcon className="w-6 h-6 text-blue-500" aria-label="Link input" />;
  if (type === 'media') return <PhotoIcon className="w-6 h-6 text-indigo-500" aria-label="Media input" />;
  return <ChatBubbleLeftRightIcon className="w-6 h-6 text-green-500" aria-label="Claim input" />;
}

export function HelpTooltip() {
  return (
    <span className="relative group ml-2">
      <InformationCircleIcon className="w-5 h-5 text-slate-400 cursor-pointer" aria-label="Help" />
      <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-10 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg" role="tooltip">
        You can check links, claims, questions, or drag and drop an image or video to analyze.
      </span>
    </span>
  );
}

// Minimal client-side analysis poller (exported here to avoid creating a new file)
export function AnalysisClientPlaceholder() {
  // This placeholder is intentionally empty; the real client component is loaded on the page via a dynamic import in the page file.
  return (
    <div id="analysis-client-root" />
  );
}
