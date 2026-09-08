"use client";

import { useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { evaluateSync } from "@mdx-js/mdx";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import type { MDXComponents } from "mdx/types";

interface MdxContentProps {
  source: string;
  components?: MDXComponents;
}

const defaultComponents: MDXComponents = {
  h1: (props) => <h1 className="text-lg font-semibold text-text mb-2" {...props} />,
  h2: (props) => <h2 className="text-base font-semibold text-text mt-4 mb-2" {...props} />,
  h3: (props) => <h3 className="text-sm font-semibold text-text mt-3 mb-1" {...props} />,
  p: (props) => <p className="text-sm text-text-muted leading-relaxed mb-3" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 text-sm text-text-muted mb-3 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 text-sm text-text-muted mb-3 space-y-1" {...props} />,
  li: (props) => <li {...props} />,
  code: (props) => <code className="px-1 py-0.5 rounded-sm bg-bg text-accent text-xs font-mono" {...props} />,
  pre: (props) => (
    <pre className="rounded-md bg-bg border border-border p-3 overflow-x-auto text-xs font-mono text-text mb-3" {...props} />
  ),
  a: (props) => <a className="text-accent underline underline-offset-2" {...props} />,
  strong: (props) => <strong className="text-text font-semibold" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-2 border-border pl-3 italic text-text-muted mb-3" {...props} />
  ),
  hr: () => <hr className="border-border my-4" />,
};

export function MdxContent({ source, components }: MdxContentProps) {
  const { default: Content } = useMemo(
    () =>
      evaluateSync(source, {
        Fragment,
        jsx,
        jsxs,
        useMDXComponents,
      }),
    [source]
  );

  return (
    <MDXProvider components={{ ...defaultComponents, ...components }}>
      <Content />
    </MDXProvider>
  );
}
