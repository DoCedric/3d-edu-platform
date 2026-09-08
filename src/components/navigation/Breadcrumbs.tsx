import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1.5 min-w-0">
            {index > 0 && <span className="text-text-muted">›</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-text-muted hover:text-text transition-colors truncate">
                {item.label}
              </Link>
            ) : (
              <span className={`truncate ${isLast ? "text-text font-medium" : "text-text-muted"}`}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
