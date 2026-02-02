import React, { useEffect, useMemo, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { literatureAssistantAPI } from '@/services/api';
import MermaidChart from '@/components/MermaidChart';
import { ImageIcon, ExternalLink, ZoomIn, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FigureAwareMarkdownProps {
  content: string;
  documentId?: string;
  className?: string;
  enableFigures?: boolean;
}

type FigureCacheEntry = {
  url?: string;
  error?: string;
  promise?: Promise<string>;
};

const figureBlobCache = new Map<string, FigureCacheEntry>();

/**
 * Thinking block component for displaying model's <think> content
 */
const ThinkingBlock: React.FC<{ content: string; isThinking?: boolean }> = memo(({ content, isThinking }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-4">
      <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
        <Brain className={cn("h-4 w-4 text-purple-500", isThinking && "animate-pulse")} />
        <span className="font-medium">
          {isThinking ? 'Thinking deeply...' : 'Reasoning process'}
        </span>
        {isThinking && (
          <span className="flex h-2 w-2 ml-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
        )}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 ml-auto" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-auto" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">
          {content}
          {isThinking && (
            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-purple-500 animate-pulse" />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';

/**
 * Placeholder component for failed image loads
 */
export const FigurePlaceholder: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-muted/50 rounded-lg border border-dashed border-border">
    <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-2" />
    <span className="text-sm text-muted-foreground">
      {label ? `${label} failed to load` : 'Image failed to load'}
    </span>
  </div>
);

/**
 * Stable image rendering component using memo to avoid unnecessary re-mounts during streaming
 */
interface FigureImageProps {
  src?: string;
  alt?: string;
  isFigureUrl: boolean;
  figureId: string | null;
  displayIndex: number | null;
}

const FigureImage = memo(({ src, alt, isFigureUrl, figureId, displayIndex }: FigureImageProps) => {
  const [authedSrc, setAuthedSrc] = useState<string | null>(null);
  const [authedError, setAuthedError] = useState<string | null>(null);

  let normalizedSrc = typeof src === 'string' ? src : '';

  // Remove flabel query parameter
  if (isFigureUrl && typeof src === 'string') {
    try {
      const u = new URL(src, window.location.origin);
      u.searchParams.delete('flabel');
      normalizedSrc = u.toString();
    } catch {
      // ignore URL parse error
    }
  }

  const shouldFetchWithJwt = (() => {
    if (!isFigureUrl || !normalizedSrc) return false;
    try {
      const u = new URL(normalizedSrc, window.location.origin);
      return u.pathname.startsWith('/api/') && u.pathname.includes('/figures');
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!shouldFetchWithJwt || !normalizedSrc) {
      setAuthedSrc(null);
      setAuthedError(null);
      return;
    }
    let revoked: string | null = null;
    let active = true;
    const cached = figureBlobCache.get(normalizedSrc);
    if (cached?.url) {
      setAuthedSrc(cached.url);
      return () => {
        active = false;
      };
    }
    if (cached?.error) {
      setAuthedError(cached.error);
      return () => {
        active = false;
      };
    }
    setAuthedSrc(null);
    setAuthedError(null);

    (async () => {
      try {
        let inflight = cached?.promise;
        if (!inflight) {
          inflight = (async () => {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = {};
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            const resp = await fetch(normalizedSrc, {
              method: 'GET',
              headers,
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            return URL.createObjectURL(blob);
          })();
          figureBlobCache.set(normalizedSrc, { promise: inflight });
        }

        const url = await inflight;
        figureBlobCache.set(normalizedSrc, { url });
        revoked = url;
        if (active) setAuthedSrc(url);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          figureBlobCache.delete(normalizedSrc);
          return;
        }
        figureBlobCache.set(normalizedSrc, { error: 'Failed to load image' });
        if (active) setAuthedError('Failed to load image');
      }
    })();

    return () => {
      active = false;
      if (revoked && !figureBlobCache.get(normalizedSrc)?.url) {
        URL.revokeObjectURL(revoked);
      }
    };
  }, [normalizedSrc, shouldFetchWithJwt]);

  const effectiveSrc = shouldFetchWithJwt ? authedSrc : normalizedSrc;

  return (
    <figure className="my-6 flex flex-col items-center">
      <Dialog>
        <DialogTrigger asChild>
          <div className="relative group cursor-zoom-in inline-block">
            {shouldFetchWithJwt && authedError ? (
              <FigurePlaceholder label={figureId || alt || undefined} />
            ) : shouldFetchWithJwt && !authedSrc ? (
              <div className="flex flex-col items-center justify-center p-8 bg-muted/50 rounded-lg border border-dashed border-border animate-pulse">
                <ImageIcon className="w-10 h-10 text-muted-foreground/50 mb-2" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <img
                src={effectiveSrc || undefined}
                alt={alt || 'Figure'}
                className={cn(
                  'rounded-lg shadow-md max-w-full h-auto',
                  'transition-transform duration-200 group-hover:scale-[1.01]',
                  isFigureUrl && 'border border-slate-200 dark:border-slate-700'
                )}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement?.classList.add('figure-error');
                }}
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-slate-600 opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-2">
          {effectiveSrc ? (
            <img
              src={effectiveSrc}
              alt={alt || 'Figure'}
              className="w-full h-auto rounded-lg"
            />
          ) : (
            <FigurePlaceholder label={figureId || alt || undefined} />
          )}
          {alt && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
              {alt}
            </p>
          )}
        </DialogContent>
      </Dialog>
      {(alt || displayIndex !== null) && (
        <figcaption className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
          {displayIndex !== null ? `Figure ${displayIndex}` : null}
          {displayIndex !== null && alt ? ': ' : null}
          {alt}
          {figureId && (
            <span className="ml-2 text-xs text-slate-400">
              (ID: {figureId})
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}, (prevProps, nextProps) => {
  return prevProps.src === nextProps.src;
});

FigureImage.displayName = 'FigureImage';

// CodeBlock component
const CodeBlock = ({ inline, className: codeClassName, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(codeClassName || '');
  let language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const isMermaidLike = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitGraph|pie|mindmap|timeline)/.test(code.trim());
  if ((!inline && language === 'mermaid') || (!inline && !language && isMermaidLike)) {
    if (!language && isMermaidLike) language = 'mermaid';
    try {
      return <MermaidChart chart={code} />;
    } catch (error) {
      console.error('Mermaid rendering error:', error);
      return (
        <div className="my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Mermaid Render Failed</div>
          <pre className="text-xs text-slate-500 dark:text-slate-400 overflow-x-auto mt-2">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
  }

  if (!inline && language) {
    return (
      <div className="relative rounded-lg overflow-x-auto my-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700">
          <span className="font-medium">{language}</span>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, padding: '1rem', fontSize: '13px', backgroundColor: '#0F172A' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code
      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sm font-mono text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
      {...props}
    >
      {children}
    </code>
  );
};

/**
 * Figure-aware Markdown rendering component
 *
 * Supports special image syntax:
 * - ![Figure X](figure:X) -> renders as document figure X
 * - ![caption](figure:label) -> finds figure by label
 *
 * Also supports standard Markdown images, code highlighting, math formulas, Mermaid charts, etc.
 * Supports <think>xxx</think> reasoning process collapsible display
 */
export const FigureAwareMarkdown: React.FC<FigureAwareMarkdownProps> = ({
  content,
  documentId,
  className,
  enableFigures = true
}) => {
  // Parse <think> tags, split content into normal content and thinking blocks
  const { segments } = useMemo(() => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let lastIndex = 0;
    const parts: Array<{ type: 'content' | 'think'; content: string; isThinking?: boolean }> = [];

    let match;
    while ((match = thinkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const beforeContent = content.slice(lastIndex, match.index).trim();
        if (beforeContent) {
          parts.push({ type: 'content', content: beforeContent });
        }
      }
      parts.push({ type: 'think', content: match[1].trim(), isThinking: false });
      lastIndex = match.index + match[0].length;
    }

    const remaining = content.slice(lastIndex);
    const unclosedThinkMatch = /<think>([\s\S]*)$/i.exec(remaining);

    if (unclosedThinkMatch) {
      const beforeThink = remaining.slice(0, unclosedThinkMatch.index).trim();
      if (beforeThink) {
        parts.push({ type: 'content', content: beforeThink });
      }
      parts.push({ type: 'think', content: unclosedThinkMatch[1].trim(), isThinking: true });
    } else {
      const finalContent = remaining.trim();
      if (finalContent) {
        parts.push({ type: 'content', content: finalContent });
      }
    }

    if (parts.length === 0 && content.trim()) {
      parts.push({ type: 'content', content });
    }

    return { segments: parts };
  }, [content]);

  // Preprocess content, convert figure:X format to actual URL
  const processContent = (text: string) => {
    if (!enableFigures || !documentId) return text;

    return text.replace(
      /!\[([^\]]*)\]\(figure:([^)]+)\)/g,
      (match, alt, label) => {
        const url = literatureAssistantAPI.getFigureUrlByLabel(documentId, label);
        const encoded = encodeURIComponent(label);
        return `![${alt}](${url}?flabel=${encoded})`;
      }
    );
  };

  // Markdown component config - use useMemo to keep reference stable
  const markdownComponents = useMemo(() => ({
    code: CodeBlock,
    p: ({ node, ...props }: any) => (
      <p className="mb-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300" {...props} />
    ),
    ul: ({ node, ...props }: any) => (
      <ul className="ml-5 my-4 space-y-2 list-disc text-slate-700 dark:text-slate-300 text-[15px]" {...props} />
    ),
    ol: ({ node, ...props }: any) => (
      <ol className="ml-5 my-4 space-y-2 list-decimal text-slate-700 dark:text-slate-300 text-[15px]" {...props} />
    ),
    li: ({ node, ...props }: any) => (
      <li className="leading-7 pl-1" {...props} />
    ),
    h1: ({ node, ...props }: any) => (
      <h1 className="text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-white tracking-tight" {...props} />
    ),
    h2: ({ node, ...props }: any) => (
      <h2 className="text-xl font-bold mt-8 mb-3 text-slate-900 dark:text-white tracking-tight" {...props} />
    ),
    h3: ({ node, ...props }: any) => (
      <h3 className="text-lg font-bold mt-6 mb-2 text-slate-900 dark:text-white" {...props} />
    ),
    h4: ({ node, ...props }: any) => (
      <h4 className="text-base font-bold mt-4 mb-2 text-slate-700 dark:text-slate-300 uppercase tracking-wide" {...props} />
    ),
    blockquote: ({ node, ...props }: any) => (
      <blockquote
        className="border-l-4 border-teal-500 pl-4 my-6 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 py-3 pr-3 rounded-r-lg"
        {...props}
      />
    ),
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-8 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
        <table className="min-w-full border-collapse" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => (
      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" {...props} />
    ),
    th: ({ node, ...props }: any) => (
      <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider" {...props} />
    ),
    td: ({ node, ...props }: any) => (
      <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-slate-700 dark:text-slate-300 text-sm" {...props} />
    ),
    strong: ({ node, ...props }: any) => (
      <strong className="font-bold text-slate-900 dark:text-white" {...props} />
    ),
    em: ({ node, ...props }: any) => (
      <em className="italic text-slate-600 dark:text-slate-400" {...props} />
    ),
    hr: ({ node, ...props }: any) => (
      <hr className="my-8 border-slate-200 dark:border-slate-700" {...props} />
    ),
    img: ({ node, src, alt, ...props }: any) => {
      const isFigureUrl = src?.includes('/figures/') || src?.includes('figure:');
      let displayIndex: number | null = null;
      let figureId: string | null = null;

      if (isFigureUrl && typeof src === 'string') {
        try {
          const u = new URL(src, window.location.origin);
          const flabel = u.searchParams.get('flabel');
          if (flabel) {
            figureId = flabel;
            const m = flabel.match(/^[Ff](\d+)/);
            if (m && m[1]) {
              displayIndex = parseInt(m[1], 10);
            }
          }
        } catch {
          // ignore URL parse error
        }
      }

      return (
        <FigureImage
          src={src}
          alt={alt}
          isFigureUrl={!!isFigureUrl}
          figureId={figureId}
          displayIndex={displayIndex}
        />
      );
    },
    a: ({ node, href, children, ...props }: any) => {
      const isExternal = href?.startsWith('http');
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-teal-600 dark:text-teal-400 hover:underline"
          {...props}
        >
          {children}
          {isExternal && <ExternalLink className="w-3 h-3 inline ml-1" />}
        </a>
      );
    },
  }), []);

  return (
    <div className={cn('prose prose-slate dark:prose-invert max-w-none break-words [word-break:break-word] [overflow-wrap:anywhere]', className)}>
      {segments.map((segment, index) => {
        if (segment.type === 'think') {
          return (
            <ThinkingBlock
              key={`think-${index}`}
              content={segment.content}
              isThinking={segment.isThinking}
            />
          );
        }
        return (
          <ReactMarkdown
            key={`content-${index}`}
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {processContent(segment.content)}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};

export default FigureAwareMarkdown;
