import { LinkIcon, ChatBubbleLeftRightIcon, PhotoIcon } from '@heroicons/react/24/outline';

export function ResultTypeIcon({ type }: { type: 'link' | 'claim' | 'media' }) {
  if (type === 'link') return <LinkIcon className="w-5 h-5 text-blue-500 inline-block align-text-bottom" aria-label="Link" />;
  if (type === 'media') return <PhotoIcon className="w-5 h-5 text-indigo-500 inline-block align-text-bottom" aria-label="Media" />;
  return <ChatBubbleLeftRightIcon className="w-5 h-5 text-green-500 inline-block align-text-bottom" aria-label="Claim" />;
}
