"use client";

import { isValidElement, memo, useRef, useState } from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function CopyButton({ getText, label = "Copy", iconOnly }: { getText: () => string; label?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {} // clipboard blocked (http / permissions): nothing useful to show
      }}
      className={`inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-ctl text-ink-3 transition-colors duration-200 ease-soft hover:bg-glass-3 hover:text-ink ${iconOnly ? "" : "px-2.5 text-xs"} ${copied ? "text-accent hover:text-accent" : ""}`}
      title={iconOnly ? (copied ? "Copied" : label) : undefined}
      aria-label={copied ? "Copied" : label}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {copied ? <path d="M20 6 9 17l-5-5" /> : <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>}
      </svg>
      {!iconOnly && (copied ? "Copied" : label)}
    </button>
  );
}

// `node` (the markdown AST) is pulled out so it isn't spread onto the DOM element
function Pre({ children, node: _node, ...props }: React.ComponentProps<"pre"> & ExtraProps) {
  const ref = useRef<HTMLPreElement>(null);
  // rehype-highlight puts "hljs language-xyz" on the inner <code>
  const cls = isValidElement<{ className?: string }>(children) ? children.props.className ?? "" : "";
  const lang = /language-([\w+#-]+)/.exec(cls)?.[1];
  return (
    <div className="code-block">
      <div className="flex items-center justify-between border-b border-line bg-glass-1 py-1 pr-1 pl-4">
        <span className="font-mono text-xs text-ink-3">{lang ?? "code"}</span>
        <CopyButton label="Copy code" getText={() => ref.current?.textContent ?? ""} />
      </div>
      <pre ref={ref} {...props}>{children}</pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true }]]}
        components={{
          pre: Pre,
          a: ({ node: _node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
