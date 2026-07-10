import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * @param {{ items: Array<{label: string, href?: string}> }} props
 */
export default function Breadcrumbs({ items }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-base-content/30 shrink-0" aria-hidden="true" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-base-content/60 hover:text-primary truncate">
                {item.label}
              </Link>
            ) : (
              <span className={`truncate ${isLast ? 'font-bold text-base-content' : 'text-base-content/60'}`} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
