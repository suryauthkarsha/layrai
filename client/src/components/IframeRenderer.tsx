interface IframeRendererProps {
  htmlContent: string;
  isInteracting: boolean;
}

export function IframeRenderer({ htmlContent, isInteracting }: IframeRendererProps) {
  const srcDoc = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
          body { margin: 0; padding: 0; background-color: #1e1e1e; color: white; overflow-x: hidden; width: 100%; height: 100%; }
          ::-webkit-scrollbar { width: 0px; background: transparent; }
      </style>
    </head>
    <body>
      ${htmlContent || '<div class="flex items-center justify-center h-screen text-white/50 font-sans">Waiting for design...</div>'}
    </body>
    </html>
  `;

  return (
    <div className="w-full h-full relative bg-neutral-900">
      <iframe 
        srcDoc={srcDoc}
        className="w-full h-full border-none block"
        title="Generated UI"
        sandbox="allow-scripts" 
        style={{ pointerEvents: isInteracting ? 'none' : 'auto' }} 
      />
      <div className={`absolute inset-0 z-50 ${isInteracting ? 'block' : 'hidden'}`}></div>
    </div>
  );
}
