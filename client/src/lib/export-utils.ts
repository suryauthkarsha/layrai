// Utility functions for exporting and capturing screens

// Delay utility
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Load external script dynamically
export const loadScript = (src: string): Promise<void> => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) { 
    resolve(); 
    return; 
  }
  const script = document.createElement('script');
  script.src = src; 
  script.onload = () => resolve(); 
  script.onerror = reject; 
  document.head.appendChild(script);
});

// Capture element as canvas - simple html2canvas approach
export const captureElement = async (
  elementId: string | null, 
  filename?: string,
  scaleFactor = 3, 
  fullViewport = false,
  rawHtml?: string
): Promise<HTMLCanvasElement | null> => {
  try {
    if (!elementId && !rawHtml) return null;
    
    // Load html2canvas first
    // @ts-ignore
    if (!window.html2canvas) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    }
    
    // @ts-ignore
    const html2canvas = window.html2canvas;
    if (!html2canvas) return null;
    
    let element = document.getElementById(elementId || '');
    
    // If rawHtml is provided, create a temporary element to capture
    let tempContainer: HTMLDivElement | null = null;
    if (rawHtml && !element) {
      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.top = '0';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '400px';
      tempContainer.style.height = '800px';
      tempContainer.innerHTML = rawHtml;
      document.body.appendChild(tempContainer);
      element = tempContainer;
      // Wait for images to load
      await delay(2000);
    }
    
    if (!element) return null;
    
    // Render with better settings for external images
    // @ts-ignore
    const canvas = await html2canvas(element, {
      backgroundColor: '#000000',
      scale: scaleFactor,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 10000,
      async: true,
      foreignObjectRendering: false
    });
    
    // Clean up temp container
    if (tempContainer) {
      document.body.removeChild(tempContainer);
    }
    
    if (canvas && filename) {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return canvas;
  } catch (error) {
    console.error('Screenshot error:', error);
    return null;
  }
};

// Export as PDF
export const exportPDF = async (elementId: string, filename: string): Promise<void> => {
  // @ts-ignore - jspdf is loaded dynamically
  if (!window.jspdf) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }
  
  // @ts-ignore
  const { jsPDF } = window.jspdf;
  const canvas = await captureElement(elementId, 2);
  if (!canvas) return;
  
  const imgData = canvas.toDataURL('image/jpeg', 1.0);
  const pdf = new jsPDF({ 
    orientation: canvas.width > canvas.height ? 'l' : 'p', 
    unit: 'px', 
    format: [canvas.width, canvas.height] 
  });
  
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
};

// Fetch with retry logic
export const fetchWithRetry = async (
  url: string, 
  options: RequestInit, 
  retries = 3
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (response.status >= 500 || response.status === 429) {
        if (i < retries - 1) { 
          await delay(Math.pow(2, i) * 1000 + Math.random() * 1000); 
          continue; 
        }
      }
      throw new Error(`API Error: ${response.status}`);
    } catch (error) {
      if (i < retries - 1) { 
        await delay(Math.pow(2, i) * 1000); 
        continue; 
      }
      throw error;
    }
  }
  throw new Error('Failed after retries');
};
