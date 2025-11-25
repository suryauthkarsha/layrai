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

// Capture element as canvas using html2canvas
export const captureElement = async (
  elementId: string | null, 
  scaleFactor = 3, 
  fullViewport = false
): Promise<HTMLCanvasElement | null> => {
  // @ts-ignore - html2canvas is loaded dynamically
  if (!window.html2canvas) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  }
  
  const options = { 
    backgroundColor: '#050505', 
    scale: scaleFactor, 
    useCORS: true, 
    logging: false 
  };
  
  if (fullViewport) {
    const element = document.querySelector('.viewport-container') as HTMLElement;
    if (!element) return null;
    // @ts-ignore
    return window.html2canvas(element, { 
      ...options, 
      x: element.scrollLeft, 
      y: element.scrollTop, 
      width: element.clientWidth, 
      height: element.clientHeight, 
      windowWidth: element.clientWidth, 
      windowHeight: element.clientHeight 
    });
  } else {
    if (!elementId) return null;
    const element = document.getElementById(elementId);
    if (!element) return null;
    // @ts-ignore
    return window.html2canvas(element, options);
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
