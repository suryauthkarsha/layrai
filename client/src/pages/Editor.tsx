import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Wand2, Download, RefreshCw, ZoomIn, ZoomOut,
  ArrowRight, Sparkles, X, Check,
  Plus,
  Trash2, MoveVertical, LayoutTemplate, FileCode, FileImage, FileText, ChevronDown,
  Camera, PenTool, Hand, RotateCcw, ArrowLeft, Eraser, MinusCircle, PlusCircle,
  Loader2, MousePointer2, Layers, Box, Image as ImageIcon, PanelLeftClose,
  Type, Square, Circle, Triangle
} from 'lucide-react';
import type { Project, Screen, Drawing } from '@shared/schema';
import { IframeRenderer } from '@/components/IframeRenderer';
import { PLATFORM_DIMENSIONS } from '@/lib/constants';
import { exportPDF, captureElement } from '@/lib/export-utils';
import { generateUI } from '@/lib/gemini';

interface EditorProps {
  project: Project;
  onSave: (project: Project) => void;
  onBack: () => void;
}

export default function Editor({ project, onSave, onBack }: EditorProps) {
  const [prompt, setPrompt] = useState('');
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'mobile' | 'desktop' | 'general'>('mobile');
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [generatedScreens, setGeneratedScreens] = useState<Screen[]>(project.data.screens || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [toolMode, setToolMode] = useState<'cursor' | 'hand' | 'pen' | 'eraser' | 'text' | 'shapes'>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeSize, setStrokeSize] = useState(4);
  const [shapeMode, setShapeMode] = useState<'rect' | 'circle' | 'triangle' | null>(null);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showStrokeSize, setShowStrokeSize] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [zoom, setZoom] = useState(0.5);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [screenCount, setScreenCount] = useState(1);
  const [isDraggingScreen, setIsDraggingScreen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [textBoxes, setTextBoxes] = useState<Array<{ id: string; x: number; y: number; text: string }>>([]);
  const [shapes, setShapes] = useState<Array<{ id: string; type: 'rect' | 'circle' | 'triangle'; x: number; y: number; width: number; height: number; color: string }>>([]);
  const [shapePreview, setShapePreview] = useState<{ x: number; y: number } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const sidebarIsOpened = !!activePanel;
  const isDrawingToolActive = toolMode === 'pen' || toolMode === 'eraser' || toolMode === 'text' || toolMode === 'shapes';
  const isInteracting = isPanning || isDrawingToolActive || isDraggingScreen;

  const fixedUILeft = sidebarIsOpened ? 'calc(50% + 160px)' : '50%';
  const fixedUIStyle: React.CSSProperties = {
    position: 'fixed',
    left: fixedUILeft as any,
    transform: 'translateX(-50%)',
    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 100
  };

  const getFixedScreenHeight = useCallback(() => PLATFORM_DIMENSIONS[platform].height, [platform]);
  const getFrameHeight = () => getFixedScreenHeight();
  const getFrameWidth = () => PLATFORM_DIMENSIONS[platform].width;

  // Keyboard pan support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only enable space panning if focused on canvas, not in textarea
      const activeElement = document.activeElement;
      const isTextarea = activeElement?.tagName === 'TEXTAREA';
      
      if (e.code === 'Space' && canvasRef.current && !isTextarea) {
        e.preventDefault();
        setIsSpacePanning(true);
      }
    };
    const handleKeyUp = () => setIsSpacePanning(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sidebar resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      // Calculate width from left edge (0) to current mouse position
      const newWidth = Math.max(250, Math.min(600, Math.max(0, e.clientX)));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingSidebar]);

  // Undo Logic
  const saveStateToHistory = (newState: Screen[]) => {
    if (generatedScreens) {
      setHistory(prev => [...prev.slice(-19), JSON.stringify(generatedScreens)]);
    }
    setGeneratedScreens(newState);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = JSON.parse(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
    setGeneratedScreens(previousState);
  };

  // Redraw overlay canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pen strokes
    drawings.forEach(d => {
      if (d.isEraser) return;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (d.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) {
        ctx.lineTo(d.points[i].x, d.points[i].y);
      }
      ctx.stroke();
    });

    // Draw shapes
    shapes.forEach(shape => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      
      if (shape.type === 'rect') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.arc(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.min(shape.width, shape.height) / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(shape.x + shape.width / 2, shape.y);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.closePath();
        ctx.stroke();
      }
    });

    // Draw shape preview
    if (isDrawing && toolMode === 'shapes' && shapeStart && shapePreview && shapeMode) {
      const w = Math.abs(shapePreview.x - shapeStart.x);
      const h = Math.abs(shapePreview.y - shapeStart.y);
      const x = Math.min(shapeStart.x, shapePreview.x);
      const y = Math.min(shapeStart.y, shapePreview.y);

      ctx.strokeStyle = customColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.7;

      if (shapeMode === 'rect') {
        ctx.strokeRect(x, y, w, h);
      } else if (shapeMode === 'circle') {
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shapeMode === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }, [drawings, shapes, isDrawing, toolMode, shapeStart, shapePreview, shapeMode, customColor]);

  // Setup canvas size
  useEffect(() => {
    const resizeCanvas = () => {
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = window.innerWidth;
        overlayCanvasRef.current.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    if (!isDrawingToolActive) return;

    const x = e.clientX;
    const y = e.clientY;

    if (toolMode === 'pen') {
      setIsDrawing(true);
      setDrawings(prev => [...prev, { color: customColor, points: [{ x, y }], strokeWidth: strokeSize, isEraser: false }]);
    } else if (toolMode === 'eraser') {
      setIsDrawing(true);
    } else if (toolMode === 'shapes' && shapeMode) {
      setIsDrawing(true);
      setShapeStart({ x, y });
      setShapePreview({ x, y });
    } else if (toolMode === 'text') {
      setTextBoxes(prev => [...prev, { id: `text-${Date.now()}`, x, y, text: 'Edit text' }]);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;

    const x = e.clientX;
    const y = e.clientY;

    if (toolMode === 'pen') {
      setDrawings(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last.isEraser) return prev;
        const newPoints = [...last.points, { x, y }];
        return [...prev.slice(0, -1), { ...last, points: newPoints }];
      });
    } else if (toolMode === 'eraser') {
      const radius = strokeSize * 2;
      setDrawings(prev =>
        prev.filter(d => !d.isEraser && !d.points.some(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < radius))
      );
    } else if (toolMode === 'shapes' && shapeStart) {
      setShapePreview({ x, y });
    }
  };

  const handleOverlayMouseUp = () => {
    if (isDrawing && toolMode === 'shapes' && shapeStart && shapePreview && shapeMode) {
      const w = Math.abs(shapePreview.x - shapeStart.x);
      const h = Math.abs(shapePreview.y - shapeStart.y);
      
      if (w > 10 && h > 10) {
        const x = Math.min(shapeStart.x, shapePreview.x);
        const y = Math.min(shapeStart.y, shapePreview.y);
        setShapes(prev => [...prev, { id: `shape-${Date.now()}`, type: shapeMode, x, y, width: w, height: h, color: customColor }]);
      }
    }

    setIsDrawing(false);
    setShapeStart(null);
    setShapePreview(null);
  };

  // Mouse Handlers for screen dragging
  const handleDragStart = useCallback((e: React.MouseEvent, screenIndex: number) => {
    if (toolMode !== 'cursor' || isPanning) return;
    e.preventDefault();
    setIsDraggingScreen(true);
    setActiveScreenIndex(screenIndex);

    const screenElement = e.currentTarget as HTMLElement;
    const rect = screenElement.getBoundingClientRect();
    
    const offsetX = (e.clientX - rect.left) / zoom;
    const offsetY = (e.clientY - rect.top) / zoom;
    
    setDragOffset({ x: offsetX, y: offsetY });
  }, [toolMode, isPanning, zoom]);

  // Save to parent
  useEffect(() => {
    onSave({
      ...project,
      updatedAt: Date.now(),
      data: { screens: generatedScreens }
    });
  }, [generatedScreens]);

  // Dragging Effect
  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDraggingScreen || !canvasRef.current) return;
      
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - canvasRect.left) / zoom + canvasRef.current.scrollLeft / zoom - dragOffset.x;
      const newY = (e.clientY - canvasRect.top) / zoom + canvasRef.current.scrollTop / zoom - dragOffset.y;
      
      setGeneratedScreens(prevScreens => {
        const newScreens = [...prevScreens];
        const screenToUpdate = newScreens[activeScreenIndex];
        if (screenToUpdate) {
          screenToUpdate.x = newX;
          screenToUpdate.y = newY;
        }
        return newScreens;
      });
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', () => {
      if (isDraggingScreen) saveStateToHistory(generatedScreens);
      setIsDraggingScreen(false);
    });

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', () => {});
    };
  }, [isDraggingScreen, activeScreenIndex, dragOffset, zoom, generatedScreens]);

  // Scroll to left on mount
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.scrollLeft = 0;
    }
  }, []);

  // Center canvas
  useEffect(() => {
    if (canvasRef.current && generatedScreens.length > 0) {
      const el = canvasRef.current;
      const screenWidth = getFrameWidth();
      const screenHeight = getFrameHeight();
      const padding = 500;

      setTimeout(() => {
        const screenPaddedWidth = screenWidth + 16;
        const horizontalScrollTarget = padding - (el.clientWidth / 2) + (screenPaddedWidth / 2);
        const verticalScrollTarget = padding - (el.clientHeight / 2) + (screenHeight / 2) - 100;
        
        el.scrollLeft = horizontalScrollTarget;
        el.scrollTop = Math.max(padding - 200, verticalScrollTarget);
      }, 50);
    }
  }, [generatedScreens.length]);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setGenerationProgress(10);

    const skeletonHeight = getFixedScreenHeight();
    const skeletonHtml = `<div class="w-full h-full bg-neutral-950 flex flex-col items-center justify-center text-neutral-600 font-mono animate-pulse p-8"><div class="w-16 h-16 bg-neutral-800 rounded-full mb-6"></div><div class="w-3/4 h-4 bg-neutral-800 rounded mb-3"></div><div class="w-1/2 h-4 bg-neutral-800 rounded"></div></div>`;
    
    // Center screens in the visible canvas under top bar
    const frameWidth = getFrameWidth();
    const frameHeight = getFixedScreenHeight();
    
    // Calculate center position in viewport
    const viewportWidth = canvasRef.current?.clientWidth || 1000;
    const viewportHeight = canvasRef.current?.clientHeight || 800;
    
    // Position multiple screens horizontally centered, with gap between them
    const totalScreensWidth = screenCount * frameWidth + (screenCount - 1) * 100;
    const startX = (viewportWidth / zoom - totalScreensWidth) / 2 + 300;
    const centerY = (viewportHeight / zoom - frameHeight) / 2 + 200;

    const newScreens: Screen[] = Array.from({ length: screenCount }).map((_, i) => ({
      name: `Screen ${i + 1}`,
      rawHtml: skeletonHtml,
      type: 'html',
      height: skeletonHeight,
      x: startX + i * (frameWidth + 100),
      y: centerY
    }));

    if (generatedScreens.length > 0) saveStateToHistory(generatedScreens);
    setGeneratedScreens(newScreens);
    setActiveScreenIndex(0);

    try {
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev < 85) {
            return prev + Math.random() * 15;
          }
          return prev;
        });
      }, 300);

      const extractedHtml = await generateUI(prompt, screenCount, platform);
      
      clearInterval(progressInterval);
      setGenerationProgress(90);

      const finalScreens = newScreens.map((screen, idx) => ({
        ...screen,
        name: extractedHtml[idx] ? `Screen ${idx + 1}` : screen.name,
        rawHtml: extractedHtml[idx] || `<div class="w-full h-full flex items-center justify-center bg-red-900/50 text-white/80">ERROR: Could not parse HTML for screen ${idx + 1}</div>`,
      }));

      setGeneratedScreens(finalScreens);
      setGenerationProgress(100);
      
      setTimeout(() => setActivePanel(null), 800);
    } catch (e: any) {
      console.error(e);
      alert(`Generation failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const deleteComponent = (idx: number) => {
    saveStateToHistory(generatedScreens);
    setGeneratedScreens(prev => prev.filter((_, i) => i !== idx));
    if (activeScreenIndex >= idx && activeScreenIndex > 0) setActiveScreenIndex(activeScreenIndex - 1);
  };

  const handleExport = async (format: 'html' | 'html-all' | 'pdf' | 'png', screenIndex: number | null) => {
    if (format === 'html' && screenIndex !== null) {
      const screen = generatedScreens[screenIndex];
      const wrappedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${screen.name}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body style="margin: 0; padding: 0; background: #1e1e1e;">
  ${screen.rawHtml}
</body>
</html>`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([wrappedHtml], { type: 'text/html' }));
      a.download = `${project.name || 'design'}-screen-${screenIndex + 1}.html`;
      a.click();
    } else if (format === 'html-all') {
      const dims = PLATFORM_DIMENSIONS[platform];
      const wrappedHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>All Screens</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; padding: 0; background: #000; }
            .screen-container { display: flex; gap: 2rem; padding: 2rem; flex-wrap: wrap; justify-content: center; }
            .screen-frame { border: 8px solid #1a1a1a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8); }
            .screen-frame.mobile { width: ${dims.width}px; border-radius: 50px; }
            .screen-frame.desktop { width: ${dims.width}px; }
            .screen-frame.general { width: ${dims.width}px; }
            iframe { border: none; display: block; width: 100%; height: ${dims.height}px; }
          </style>
        </head>
        <body>
          <div class="screen-container">
            ${generatedScreens.map((screen, idx) => `
              <div class="screen-frame ${platform}">
                <iframe srcdoc="${screen.rawHtml.replace(/"/g, '&quot;')}" style="width: 100%; height: ${dims.height}px;"></iframe>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([wrappedHtml], { type: 'text/html' }));
      a.download = 'all-screens.html';
      a.click();
    } else if (format === 'pdf' && screenIndex !== null) {
      exportPDF(`screen-${screenIndex}`, generatedScreens[screenIndex].name);
    } else if (format === 'png' && screenIndex !== null) {
      // Capture the specific screen frame
      const screenElement = document.getElementById(`screen-${screenIndex}`);
      if (screenElement) {
        await captureElement(`screen-${screenIndex}`, `${project.name || 'design'}-screen-${screenIndex + 1}`, 3, false);
      }
    }
  };

  const setSoloToolMode = (tool: typeof toolMode) => {
    setToolMode(tool);
    if (tool !== 'pen' && tool !== 'eraser' && tool !== 'text' && tool !== 'shapes') {
      setShowShapeMenu(false);
    }
  };

  const handleGenerateClick = () => {
    setActivePanel('generate');
  };

  return (
    <div className="flex h-screen bg-[#050505]">
      {/* Overlay Canvas for Drawing */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: isDrawingToolActive ? 'auto' : 'none',
          zIndex: 40,
          cursor: toolMode === 'pen' ? 'crosshair' : toolMode === 'eraser' ? 'grab' : toolMode === 'text' ? 'text' : 'pointer'
        }}
        onMouseDown={handleOverlayMouseDown}
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        onMouseLeave={handleOverlayMouseUp}
      />

      {/* Sidebar */}
      {activePanel === 'generate' && (
        <div 
          className={`bg-[#1A1A1A] border-r border-white/10 overflow-auto flex flex-col relative group flex-shrink-0 ${isGenerating ? 'shadow-2xl shadow-blue-500/40' : ''}`}
          style={{ width: sidebarWidth + 'px', transition: isResizingSidebar ? 'none' : 'width 0.2s' }}
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-lg font-bold text-white" data-testid="heading-generate">Generate UI</h2>
            <button onClick={() => setActivePanel(null)} className="p-1 hover:bg-white/10 rounded" data-testid="button-close-panel">
              <X size={18} className="text-neutral-400" />
            </button>
          </div>
          <div className="flex-1 p-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-neutral-300 block mb-3" data-testid="label-prompt">Design Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleGenerate();
                  }
                }}
                placeholder="Describe the UI you want... (spaces work fine)"
                className="w-full h-32 bg-[#252525] border-2 border-blue-500/60 rounded-lg p-4 text-base text-white placeholder-neutral-400 focus:outline-none focus:border-blue-300 focus:shadow-[0_0_30px_rgba(59,130,246,1)] resize-none transition-all"
                data-testid="input-prompt"
                spellCheck="false"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-neutral-300 block mb-3" data-testid="label-platform">Platform</label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setPlatform('mobile')} className={`p-3 rounded-lg border-2 transition-all text-center ${platform === 'mobile' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 bg-[#252525] text-neutral-300 hover:border-white/20'}`} data-testid="button-platform-mobile">
                  <div className="text-sm font-semibold">iPhone 13 Pro</div>
                  <div className="text-xs text-neutral-400">430x932</div>
                </button>
                <button onClick={() => setPlatform('desktop')} className={`p-3 rounded-lg border-2 transition-all text-center ${platform === 'desktop' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 bg-[#252525] text-neutral-300 hover:border-white/20'}`} data-testid="button-platform-desktop">
                  <div className="text-sm font-semibold">MacBook Air 15"</div>
                  <div className="text-xs text-neutral-400">1728x1117</div>
                </button>
                <button onClick={() => setPlatform('general')} className={`p-3 rounded-lg border-2 transition-all text-center ${platform === 'general' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 bg-[#252525] text-neutral-300 hover:border-white/20'}`} data-testid="button-platform-general">
                  <div className="text-sm font-semibold">General</div>
                  <div className="text-xs text-neutral-400">1200x800</div>
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-neutral-300 block mb-3" data-testid="label-count">Screens</label>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => setScreenCount(Math.max(1, screenCount - 1))} className="p-2 rounded-lg bg-[#252525] border border-white/10 hover:border-white/20 text-neutral-300 hover:text-white transition-all" data-testid="button-screen-minus">
                  <MinusCircle size={20} />
                </button>
                <span className="text-2xl font-bold text-white w-12 text-center" data-testid="text-screen-count">{screenCount}</span>
                <button onClick={() => setScreenCount(Math.min(5, screenCount + 1))} className="p-2 rounded-lg bg-[#252525] border border-white/10 hover:border-white/20 text-neutral-300 hover:text-white transition-all" data-testid="button-screen-plus">
                  <PlusCircle size={20} />
                </button>
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-white/10 space-y-3">
            <button onClick={handleGenerate} disabled={isGenerating || !prompt} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2" data-testid="button-generate">
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
            <button onClick={() => setActivePanel(null)} className="w-full bg-neutral-800/50 hover:bg-neutral-700/50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors" data-testid="button-cancel">Cancel</button>
          </div>
          {/* Resize Handle */}
          <div
            onMouseDown={() => setIsResizingSidebar(true)}
            className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize transition-colors"
            style={{ width: '6px', right: '-3px' }}
            title="Drag to resize sidebar"
          />
        </div>
      )}

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar - Floating Glass */}
        <div className="fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-50 backdrop-blur-2xl bg-black/30 border border-white/5 rounded-2xl shadow-2xl px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-6 flex-wrap max-w-[95vw]">
          <button onClick={onBack} className="p-1.5 sm:p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-all" data-testid="button-back">
            <ArrowLeft size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <div className="hidden sm:flex items-center gap-3 px-2 py-1">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1 sm:p-1.5 text-neutral-400 hover:text-white" data-testid="button-zoom-out">
              <ZoomOut size={12} className="sm:w-[16px] sm:h-[16px]" />
            </button>
            <span className="text-xs sm:text-sm text-neutral-300 w-8 sm:w-10 text-center font-medium" data-testid="text-zoom">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 sm:p-1.5 text-neutral-400 hover:text-white" data-testid="button-zoom-in">
              <ZoomIn size={12} className="sm:w-[16px] sm:h-[16px]" />
            </button>
          </div>

          <button onClick={handleGenerateClick} className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1 sm:gap-2 shadow-lg whitespace-nowrap" data-testid="button-generate-panel">
            <Sparkles size={12} className="sm:w-[16px] sm:h-[16px]" />
            <span className="hidden sm:inline">Generate</span>
          </button>

          <div className="relative">
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-neutral-300 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded-lg transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap" data-testid="button-export">
              <Download size={12} className="sm:w-[16px] sm:h-[16px]" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown size={10} className="hidden sm:inline sm:w-[14px] sm:h-[14px]" />
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-44 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <div onClick={() => { handleExport('html', activeScreenIndex); setExportMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-white/10 text-white cursor-pointer" data-testid="button-export-html">
                  <FileCode size={14} className="text-blue-400" /> Screen HTML
                </div>
                <div onClick={() => { handleExport('html-all', null); setExportMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-white/10 text-white cursor-pointer" data-testid="button-export-html-all">
                  <FileCode size={14} className="text-cyan-400" /> All HTML
                </div>
                <div onClick={() => { handleExport('pdf', activeScreenIndex); setExportMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-white/10 text-white cursor-pointer" data-testid="button-export-pdf">
                  <FileText size={14} className="text-red-400" /> PDF
                </div>
                <div onClick={() => { handleExport('png', activeScreenIndex); setExportMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-white/10 text-white cursor-pointer" data-testid="button-export-png">
                  <FileImage size={14} className="text-purple-400" /> Image
                </div>
              </div>
            )}
          </div>

          <button onClick={undo} disabled={history.length === 0} className="hidden sm:flex p-1.5 sm:p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 disabled:text-neutral-600 disabled:hover:bg-transparent transition-all" data-testid="button-undo">
            <RotateCcw size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>
        
        {/* Spacer for floating top bar */}
        <div className="h-0"></div>

        {/* Canvas Area */}
        <div 
          ref={canvasRef} 
          className={`viewport-container flex-1 relative overflow-auto ${toolMode === 'hand' || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${isGenerating ? 'shadow-2xl shadow-blue-500/60 inset' : ''}`}
          style={isGenerating ? {
            boxShadow: 'inset 0 0 40px rgba(59, 130, 246, 0.6), inset 0 0 100px rgba(59, 130, 246, 0.3)',
          } : undefined}
          onMouseDown={(e) => {
            if ((toolMode === 'hand' || isSpacePanning) && !isPanning) {
              setIsPanning(true);
              setPanStart({ x: e.clientX, y: e.clientY });
              setScrollStart({ left: canvasRef.current?.scrollLeft || 0, top: canvasRef.current?.scrollTop || 0 });
            } else if (toolMode === 'cursor') {
              const screenTarget = (e.target as HTMLElement).closest('.draggable-screen');
              if (screenTarget) {
                const idx = parseInt((screenTarget as HTMLElement).dataset.index || '0', 10);
                handleDragStart(e, idx);
              }
            }
          }}
          onMouseMove={(e) => {
            if (isPanning && canvasRef.current) {
              canvasRef.current.scrollLeft = scrollStart.left - (e.clientX - panStart.x);
              canvasRef.current.scrollTop = scrollStart.top - (e.clientY - panStart.y);
            }
          }}
          onMouseUp={() => setIsPanning(false)}
          onWheel={(e) => { 
            if (e.ctrlKey || e.metaKey) { 
              e.preventDefault(); 
              setZoom(z => Math.min(Math.max(0.2, z - e.deltaY * 0.001), 3)); 
            }
          }}
          style={{
            backgroundColor: '#050505',
            backgroundImage: zoom >= 0.20 ? `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)` : 'none',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundRepeat: 'repeat',
            backgroundAttachment: 'local',
          }}
        >
          {/* Generation Progress */}
          {isGenerating && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[45] transition-all duration-300" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 45 }}>
              <div className="absolute inset-0 m-[-150px] animate-[subtle-pulse_2s_ease-in-out_infinite] mix-blend-screen z-[20] rounded-full bg-blue-600/10 blur-[100px]"></div>
              <div className="relative p-6 rounded-xl bg-[#1A1A1A]/95 border border-blue-500/50 backdrop-blur-lg shadow-2xl shadow-blue-900/50 z-[40] flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-400" size={24} />
                <p className="text-lg font-bold text-white tracking-wider">
                  UI Completion: <span className="text-blue-400" data-testid="text-generation-progress">{Math.round(generationProgress)}%</span>
                </p>
              </div>
            </div>
          )}
          
          <div 
            id="canvas-root" 
            className="flex gap-32 transition-transform duration-200 ease-out" 
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: 'top left',
              minWidth: 'fit-content', 
              minHeight: 'fit-content', 
              padding: '600px 500px', 
              gap: '300px' 
            }}
          >
            {/* Initial placeholder - centered on canvas */}
            {generatedScreens.length === 0 && !isGenerating && (
              <div className="fixed z-10 flex flex-col items-center justify-center" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                <div className="w-40 h-40 rounded-full bg-blue-600/20 border-2 border-blue-500/40 flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-pulse">
                  <Wand2 size={60} className="text-blue-400" />
                </div>
              </div>
            )}

            {/* Screen Frames */}
            {generatedScreens?.map((screen, idx) => (
              <div 
                key={idx} 
                id={`screen-${idx}`} 
                data-index={idx}
                onClick={() => setActiveScreenIndex(idx)} 
                onMouseDown={toolMode === 'cursor' ? (e) => handleDragStart(e, idx) : undefined}
                className={`draggable-screen relative group ${idx === activeScreenIndex ? 'ring-4 ring-blue-500 z-10 shadow-2xl shadow-blue-500/50' : 'hover:scale-[1.01]'} ${toolMode === 'cursor' ? 'cursor-grab' : ''}`}
                style={{
                  transform: `translate(${(screen.x || 0)}px, ${(screen.y || 0)}px)${idx === activeScreenIndex ? ' scale(1.02)' : ''}`,
                  transformOrigin: 'top left',
                  zIndex: isGenerating ? 2 : (activeScreenIndex === idx && isDraggingScreen ? 60 : activeScreenIndex === idx ? 10 : 5),
                  transition: isDraggingScreen ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                data-testid={`screen-${idx}`}
              >
                <div className="absolute -top-14 left-0 right-0 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                  <span className="text-sm font-bold text-neutral-500 bg-black/50 px-3 py-1 rounded-full" data-testid={`text-screen-name-${idx}`}>{screen.name}</span>
                  <div className="flex gap-1 bg-[#1A1A1A] p-1 rounded-lg border border-white/10 shadow-lg">
                    <button onClick={(e) => { e.stopPropagation(); deleteComponent(idx); }} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded text-neutral-400" title="Delete" data-testid={`button-delete-screen-${idx}`}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); captureElement(`screen-${idx}`, `screen-${idx}`); }} className="p-2 hover:bg-white/10 rounded text-neutral-400 hover:text-white" title="Save" data-testid={`button-export-screen-${idx}`}>
                      <Camera size={14} />
                    </button>
                  </div>
                </div>
                <div 
                  className={`bg-black shadow-2xl overflow-hidden relative border-[8px] border-[#1a1a1a] ring-1 ring-white/10 ${idx === activeScreenIndex ? 'shadow-blue-500/50 shadow-2xl' : ''} ${platform === 'mobile' ? 'w-[430px] rounded-[50px]' : platform === 'desktop' ? 'w-[1728px] rounded-xl' : 'w-[1200px] rounded-xl'}`} 
                  style={{ height: getFrameHeight() + 'px' }}
                >
                  {platform === 'mobile' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1a1a1a] rounded-b-xl z-20 pointer-events-none"></div>}
                  <IframeRenderer htmlContent={screen.rawHtml} isInteracting={isInteracting} />
                </div>
              </div>
            ))}
          </div>
          
          {/* Text boxes */}
          {textBoxes.map(textBox => (
            <div
              key={textBox.id}
              style={{
                position: 'fixed',
                left: textBox.x,
                top: textBox.y,
                zIndex: 35
              }}
              className="bg-white text-black p-2 rounded border border-gray-300 shadow-md"
            >
              <input
                type="text"
                value={textBox.text}
                onChange={(e) => setTextBoxes(prev => 
                  prev.map(tb => tb.id === textBox.id ? { ...tb, text: e.target.value } : tb)
                )}
                className="outline-none bg-transparent border-none w-auto min-w-[100px]"
                autoFocus
              />
            </div>
          ))}
        </div>

        {/* Bottom Toolbar - Floating Glass */}
        <div className="fixed bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 backdrop-blur-2xl bg-black/30 border border-white/5 rounded-2xl shadow-2xl px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-center gap-1 sm:gap-3 flex-wrap max-w-[95vw]">
          <button onClick={() => setSoloToolMode('cursor')} className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${toolMode === 'cursor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-tool-cursor">
            <MousePointer2 size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <button onClick={() => setSoloToolMode('hand')} className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${toolMode === 'hand' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-tool-hand">
            <Hand size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <button onClick={() => setSoloToolMode('eraser')} className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${toolMode === 'eraser' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-tool-eraser">
            <Eraser size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <button onClick={() => setSoloToolMode('pen')} className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${toolMode === 'pen' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-tool-pen">
            <PenTool size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <div className="relative">
            <button onClick={() => setSoloToolMode('shapes')} className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${toolMode === 'shapes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-tool-shapes">
              <Box size={14} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            {toolMode === 'shapes' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl p-2 flex gap-1.5">
                <div onClick={() => setShapeMode('rect')} className={`p-2 rounded-lg transition-all cursor-pointer ${shapeMode === 'rect' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-shape-rect">
                  <Square size={14} />
                </div>
                <div onClick={() => setShapeMode('circle')} className={`p-2 rounded-lg transition-all cursor-pointer ${shapeMode === 'circle' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-shape-circle">
                  <Circle size={14} />
                </div>
                <div onClick={() => setShapeMode('triangle')} className={`p-2 rounded-lg transition-all cursor-pointer ${shapeMode === 'triangle' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-shape-triangle">
                  <Triangle size={14} />
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setSoloToolMode('text')} className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${toolMode === 'text' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} data-testid="button-tool-text">
            <Type size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <button onClick={undo} disabled={history.length === 0} className="hidden sm:flex p-1.5 sm:p-2.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 disabled:text-neutral-600 disabled:hover:bg-transparent transition-all" data-testid="button-undo">
            <RotateCcw size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <button onClick={() => colorInputRef.current?.click()} className="p-1.5 sm:p-2.5 rounded-full transition-all border-2 border-white/20 hover:border-white/40" style={{ backgroundColor: customColor, width: '24px', height: '24px' }} title="Click to change color" data-testid="button-color-picker">
          </button>
          <input ref={colorInputRef} type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="hidden" data-testid="input-color-hidden" />

          <div className="relative">
            <button onClick={() => setShowStrokeSize(!showStrokeSize)} className="p-1.5 sm:p-2.5 rounded-lg transition-all text-neutral-400 hover:text-white hover:bg-white/10" data-testid="button-stroke-toggle">
              <span className="text-[10px] sm:text-xs font-semibold">{strokeSize}px</span>
            </button>
            {showStrokeSize && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl p-3 flex flex-col gap-2">
                <input type="range" min="1" max="20" value={strokeSize} onChange={(e) => setStrokeSize(parseInt(e.target.value))} className="w-24" data-testid="input-stroke-size" />
                <span className="text-xs text-neutral-400 text-center">{strokeSize}px</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
