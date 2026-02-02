import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Move, Fullscreen, Download, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MermaidChartProps {
  chart: string;
  id?: string;
  className?: string;
}

/**
 * Wrap long text to fit node width
 */
function wrapLongText(text: string, maxCharsPerLine: number = 20): string {
  if (!text) return text;

  const getCharWidth = (char: string) => /[\u4e00-\u9fff]/.test(char) ? 2 : 1;

  const getStringWidth = (str: string) => {
    let width = 0;
    for (const char of str) {
      width += getCharWidth(char);
    }
    return width;
  };

  if (getStringWidth(text) <= maxCharsPerLine) {
    return text;
  }

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  const tokens: string[] = [];
  let currentToken = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (/[\u4e00-\u9fff]/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      tokens.push(char);
    } else if (char === ' ' || char === '\n' || char === '-') {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      tokens.push(char);
    } else {
      currentToken += char;
    }
  }
  if (currentToken) {
    tokens.push(currentToken);
  }

  for (const token of tokens) {
    const tokenWidth = getStringWidth(token);

    if (token === '\n') {
      lines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
      continue;
    }

    if (tokenWidth > maxCharsPerLine) {
        if (currentLine) {
            lines.push(currentLine);
            currentLine = '';
            currentWidth = 0;
        }
        lines.push(token);
        continue;
    }

    if (currentWidth + tokenWidth > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine);

      if (token.trim() === '') {
        currentLine = '';
        currentWidth = 0;
      } else {
        currentLine = token;
        currentWidth = tokenWidth;
      }
    } else {
      currentLine += token;
      currentWidth += tokenWidth;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('<br/>');
}

/**
 * Sanitize Mermaid code
 */
function sanitizeMermaidCode(code: string): string {
  let result = code.trim();

  result = result.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '');

  const isSequence = /^sequenceDiagram/im.test(result);

  if (isSequence) {
    const lines = result.split('\n');
    const fixedLines = lines.map(line => {
      const trimmed = line.trim();

      const blockKeywords = /^(loop|alt|opt|par|critical|else|break)\s+(.+)$/i;
      const match = trimmed.match(blockKeywords);
      if (match) {
        const keyword = match[1];
        let label = match[2].trim();
        label = label.replace(/\s{2,}/g, ' ');
        return `    ${keyword} ${label}`;
      }

      return line;
    });

    result = fixedLines.join('\n');
  }

  const isFlowchart = /^(flowchart|graph)\s+(TD|TB|BT|RL|LR)/im.test(result);
  if (isFlowchart) {
    const lines = result.split('\n');
    const fixedLines = lines.map((line, idx) => {
      if (idx === 0) return line;

      line = line.replace(/(\w+)\["([^"]+)"\]/g, (match, nodeId, label) => {
        const safeLabel = label
          .replace(/:/g, '：')
          .replace(/"/g, "'")
          .replace(/\n/g, ' ');
        const wrappedLabel = wrapLongText(safeLabel, 20);
        return `${nodeId}["${wrappedLabel}"]`;
      });

      line = line.replace(/(\w+)\("([^"]+)"\)/g, (match, nodeId, label) => {
        const safeLabel = label
          .replace(/:/g, '：')
          .replace(/"/g, "'")
          .replace(/\n/g, ' ');
        const wrappedLabel = wrapLongText(safeLabel, 20);
        return `${nodeId}("${wrappedLabel}")`;
      });

      line = line.replace(/(\w+)\{"([^"]+)"\}/g, (match, nodeId, label) => {
        const safeLabel = label
          .replace(/:/g, '：')
          .replace(/"/g, "'")
          .replace(/\n/g, ' ');
        const wrappedLabel = wrapLongText(safeLabel, 20);
        return `${nodeId}{"${wrappedLabel}"}`;
      });

      if (/^(\s*)[\u4e00-\u9fff]/.test(line)) {
        line = line.replace(/^(\s*)([\u4e00-\u9fff\w]+)([\[\(\{])/, (match, indent, nodeId, bracket) => {
          if (/[\u4e00-\u9fff]/.test(nodeId)) {
            return `${indent}Node${idx}${bracket}`;
          }
          return match;
        });
      }

      return line;
    });

    result = fixedLines.join('\n');
  }

  return result;
}

const MermaidChart: React.FC<MermaidChartProps> = ({ chart, id, className }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const modalChartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>(id || `mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const chartId = idRef.current;
  const largeIdRef = useRef<string>(`${chartId}-lg`);
  const chartIdLarge = largeIdRef.current;
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomLarge, setZoomLarge] = useState(1);

  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panOffsetLarge, setPanOffsetLarge] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  const renderInto = async (target: HTMLDivElement | null, id: string) => {
    if (!target) return;

    const sanitizedChart = sanitizeMermaidCode(chart);

    try {
      target.innerHTML = '';
      // @ts-ignore
      const isValid = await mermaid.parse(sanitizedChart);
      if (isValid) {
        const { svg } = await mermaid.render(id, sanitizedChart);
        if (target) {
          target.innerHTML = svg;
          const svgEl = target.querySelector('svg');
          if (svgEl) {
            svgEl.classList.add('mermaid-svg-enhanced');
            svgEl.style.maxWidth = 'none';
            svgEl.style.height = 'auto';
          }
        }
      } else {
        target.innerHTML = `
          <div class="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            <div class="font-semibold mb-2">Mermaid syntax error</div>
            <details class="mt-2">
              <summary class="cursor-pointer text-xs text-slate-500">View source</summary>
              <pre class="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">${sanitizedChart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </details>
          </div>`;
      }
    } catch (error) {
      console.error('Mermaid render error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (target) {
        target.innerHTML = `
          <div class="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            <div class="font-semibold mb-1">Chart render failed</div>
            <div class="text-xs text-red-400 mb-2">${errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <details class="mt-2">
              <summary class="cursor-pointer text-xs text-slate-500">View source</summary>
              <pre class="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">${sanitizedChart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </details>
          </div>`;
      }
    }
  };

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: 14,
      themeVariables: {
        primaryColor: '#3B82F6',
        primaryTextColor: '#1E293B',
        primaryBorderColor: '#2563EB',
        secondaryColor: '#E0E7FF',
        secondaryTextColor: '#374151',
        secondaryBorderColor: '#6366F1',
        tertiaryColor: '#F0FDF4',
        tertiaryTextColor: '#166534',
        tertiaryBorderColor: '#22C55E',
        background: '#FFFFFF',
        mainBkg: '#F8FAFC',
        nodeBorder: '#CBD5E1',
        lineColor: '#64748B',
        textColor: '#334155',
        nodeTextColor: '#1E293B',
        fontFamily: 'inherit',
        nodeBkg: '#FFFFFF',
      },
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        padding: 20,
        nodeSpacing: 60,
        rankSpacing: 60,
        diagramPadding: 8,
        wrappingWidth: 280,
      },
      sequence: {
        useMaxWidth: false,
        wrap: true,
        width: 180,
        height: 40,
        boxMargin: 8,
        boxTextMargin: 5,
        noteMargin: 8,
        messageMargin: 30,
        mirrorActors: true,
        actorMargin: 50,
        wrapPadding: 10,
      },
    });

    renderInto(chartRef.current, chartId);
  }, [chart, chartId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      await renderInto(modalChartRef.current, chartIdLarge);
      setTimeout(() => {
        fitToContainer(true);
      }, 100);
    }, 50);
    return () => clearTimeout(t);
  }, [open, chartIdLarge, chart]);

  useEffect(() => {
    const el = chartRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (el) {
      el.style.transformOrigin = 'center center';
      el.style.transform = `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`;
      el.style.display = 'inline-block';
      el.style.transition = isPanning ? 'none' : 'transform 0.15s ease-out';
    }
  }, [zoom, panOffset, isPanning]);

  useEffect(() => {
    const el = modalChartRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (el) {
      el.style.transformOrigin = 'center center';
      el.style.transform = `scale(${zoomLarge}) translate(${panOffsetLarge.x}px, ${panOffsetLarge.y}px)`;
      el.style.display = 'inline-block';
      el.style.transition = isPanning ? 'none' : 'transform 0.15s ease-out';
    }
  }, [zoomLarge, panOffsetLarge, open, isPanning]);

  const zoomIn = () => setZoom(z => Math.min(4, +(z + 0.15).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.25, +(z - 0.15).toFixed(2)));
  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };
  const zoomInLarge = () => setZoomLarge(z => Math.min(5, +(z + 0.15).toFixed(2)));
  const zoomOutLarge = () => setZoomLarge(z => Math.max(0.25, +(z - 0.15).toFixed(2)));
  const resetViewLarge = () => {
    setZoomLarge(1);
    setPanOffsetLarge({ x: 0, y: 0 });
  };

  const fitToContainer = useCallback((isLarge: boolean) => {
    const container = isLarge ? modalContainerRef.current : containerRef.current;
    const chartEl = isLarge ? modalChartRef.current : chartRef.current;
    const svg = chartEl?.querySelector('svg');
    if (!container || !svg) return;

    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const currentZoom = isLarge ? zoomLarge : zoom;

    const actualWidth = svgRect.width / currentZoom;
    const actualHeight = svgRect.height / currentZoom;

    const scaleX = (containerRect.width - 40) / actualWidth;
    const scaleY = (containerRect.height - 40) / actualHeight;
    const newZoom = Math.min(scaleX, scaleY, 2);

    if (isLarge) {
      setZoomLarge(Math.max(0.25, +newZoom.toFixed(2)));
      setPanOffsetLarge({ x: 0, y: 0 });
    } else {
      setZoom(Math.max(0.25, +newZoom.toFixed(2)));
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoom, zoomLarge]);

  const handleMouseDown = (e: React.MouseEvent, isLarge: boolean) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    const dx = (e.clientX - dragStart.x) / (open ? zoomLarge : zoom);
    const dy = (e.clientY - dragStart.y) / (open ? zoomLarge : zoom);

    if (open) {
      setPanOffsetLarge(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, dragStart, open, zoom, zoomLarge]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent, isLarge: boolean) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      if (isLarge) {
        setZoomLarge(z => Math.max(0.25, Math.min(5, +(z + delta).toFixed(2))));
      } else {
        setZoom(z => Math.max(0.25, Math.min(4, +(z + delta).toFixed(2))));
      }
    }
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(sanitizeMermaidCode(chart));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const downloadSvg = () => {
    const svg = (open ? modalChartRef : chartRef).current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mermaid-chart-${chartId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  const Toolbar = ({ isLarge = false }: { isLarge?: boolean }) => {
    const currentZoom = isLarge ? zoomLarge : zoom;
    const zoomPercent = Math.round(currentZoom * 100);

    return (
      <TooltipProvider delayDuration={300}>
        <div className={cn(
          "flex items-center gap-0.5 rounded-lg px-1.5 py-1 shadow-lg border backdrop-blur-sm",
          "bg-white/95 dark:bg-slate-800/95 border-slate-200 dark:border-slate-700",
          isLarge ? "" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={isLarge ? zoomOutLarge : zoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zoom out (Ctrl+scroll)</TooltipContent>
          </Tooltip>

          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[40px] text-center">
            {zoomPercent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={isLarge ? zoomInLarge : zoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zoom in (Ctrl+scroll)</TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={() => fitToContainer(isLarge)}
              >
                <Fullscreen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Fit to window</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={isLarge ? resetViewLarge : resetView}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset view</TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={copyCode}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{copied ? 'Copied!' : 'Copy code'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={downloadSvg}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Download SVG</TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-7 w-7", isLarge && "h-8 w-8")}
                onClick={() => {
                  if (isLarge) {
                    setOpen(false);
                  } else {
                    setOpen(true);
                    setZoomLarge(Math.max(1, zoom));
                    setPanOffsetLarge(panOffset);
                  }
                }}
              >
                {isLarge ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{isLarge ? 'Collapse' : 'Fullscreen'}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn("relative my-4", className)}>
      <div
        ref={containerRef}
        className={cn(
          "group relative rounded-xl border overflow-hidden",
          "bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800",
          "border-slate-200 dark:border-slate-700",
          "shadow-sm hover:shadow-md transition-shadow duration-300",
          isPanning && "cursor-grabbing"
        )}
      >
        <div
          className={cn(
            "relative overflow-auto p-4 min-h-[150px] max-h-[500px]",
            !isPanning && "cursor-grab"
          )}
          onMouseDown={(e) => handleMouseDown(e, false)}
          onWheel={(e) => handleWheel(e, false)}
        >
          <div
            ref={chartRef}
            className="flex items-center justify-center min-h-[120px] mermaid-chart-container"
          />
        </div>

        <div className="absolute bottom-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded-md">
            <Move className="h-3 w-3" />
            <span>Drag to pan · Ctrl+scroll to zoom</span>
          </div>
        </div>

        <div className="absolute top-3 right-3 z-10">
          <Toolbar isLarge={false} />
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setZoomLarge(1);
          setPanOffsetLarge({ x: 0, y: 0 });
        }
      }}>
        <DialogContent className="max-w-[95vw] w-[min(1400px,95vw)] h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">Mermaid Chart Preview</DialogTitle>
              <Toolbar isLarge={true} />
            </div>
          </DialogHeader>
          <div
            ref={modalContainerRef}
            className={cn(
              "relative flex-1 min-h-0 w-full",
              "bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800",
              isPanning ? "cursor-grabbing" : "cursor-grab"
            )}
            onMouseDown={(e) => handleMouseDown(e, true)}
            onWheel={(e) => handleWheel(e, true)}
            onDoubleClick={() => fitToContainer(true)}
          >
            <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4">
              <div
                ref={modalChartRef}
                className="mermaid-chart-container mermaid-fullscreen-chart"
              />
            </div>

            <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <Move className="h-3.5 w-3.5" />
                <span>Drag to pan · Ctrl+scroll to zoom · Double-click to fit</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .mermaid-chart-container svg {
          max-width: none !important;
          height: auto !important;
        }

        .mermaid-fullscreen-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 100%;
          min-height: 100%;
        }

        .mermaid-fullscreen-chart svg {
          max-width: none !important;
          max-height: none !important;
        }

        .mermaid-svg-enhanced .node rect,
        .mermaid-svg-enhanced .node circle,
        .mermaid-svg-enhanced .node ellipse,
        .mermaid-svg-enhanced .node polygon,
        .mermaid-svg-enhanced .node path {
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
          transition: filter 0.2s ease;
        }

        .mermaid-svg-enhanced .node:hover rect,
        .mermaid-svg-enhanced .node:hover circle,
        .mermaid-svg-enhanced .node:hover ellipse,
        .mermaid-svg-enhanced .node:hover polygon {
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
        }

        .mermaid-svg-enhanced .nodeLabel,
        .mermaid-svg-enhanced .label {
          font-family: inherit;
          line-height: 1.4;
        }

        .mermaid-svg-enhanced foreignObject {
          overflow: visible !important;
        }

        .mermaid-svg-enhanced foreignObject > div,
        .mermaid-svg-enhanced foreignObject > span,
        .mermaid-svg-enhanced .nodeLabel > div,
        .mermaid-svg-enhanced .nodeLabel > span,
        .mermaid-svg-enhanced .label > div,
        .mermaid-svg-enhanced .label > span {
          display: block !important;
          text-align: center;
          line-height: 1.5;
          word-break: break-word;
          white-space: normal;
        }

        .mermaid-svg-enhanced .label-container {
          overflow: visible !important;
        }

        .mermaid-svg-enhanced br {
          display: block;
          content: "";
          margin-top: 2px;
        }

        .mermaid-svg-enhanced .edgePath .path {
          stroke-width: 1.5px;
          transition: stroke-width 0.2s ease;
        }

        .mermaid-svg-enhanced .edgePath:hover .path {
          stroke-width: 2.5px;
        }

        .mermaid-svg-enhanced marker path {
          fill: #64748b;
        }

        .mermaid-svg-enhanced .cluster rect {
          fill: #f8fafc !important;
          stroke: #e2e8f0 !important;
          stroke-width: 1.5px;
          rx: 6px;
          ry: 6px;
        }

        .dark .mermaid-svg-enhanced .cluster rect {
          fill: #1e293b !important;
          stroke: #334155 !important;
        }

        .mermaid-svg-enhanced .actor {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }

        .mermaid-svg-enhanced .messageLine0,
        .mermaid-svg-enhanced .messageLine1 {
          stroke-width: 1.5px;
        }

        .mermaid-svg-enhanced .messageText {
          font-size: 12px;
        }

        .mermaid-svg-enhanced .note {
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1));
        }

        .mermaid-svg-enhanced .flowchart-link {
          stroke: #64748b;
        }

        .dark .mermaid-svg-enhanced .nodeLabel,
        .dark .mermaid-svg-enhanced .label {
          color: #e2e8f0;
        }

        .dark .mermaid-svg-enhanced marker path {
          fill: #94a3b8;
        }

        .dark .mermaid-svg-enhanced .flowchart-link {
          stroke: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default MermaidChart;
export { MermaidChart };
