// Pexels API utility for getting high-quality images

const PEXELS_API_KEY = process.env.PEXELS_API_KEY?.trim();
const PEXELS_API_BASE = 'https://api.pexels.com/v1';

interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

interface PexelsResponse {
  photos: PexelsPhoto[];
}

/**
 * Get a random image URL from Pexels with a specific keyword
 */
export async function getPexelsImageUrl(keyword: string, width: number = 800, height: number = 600): Promise<string> {
  try {
    if (!PEXELS_API_KEY) {
      console.warn('PEXELS_API_KEY not configured, using fallback gradient');
      return `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;
    }

    // Get random page to ensure variety
    const randomPage = Math.floor(Math.random() * 100) + 1;
    
    const response = await fetch(
      `${PEXELS_API_BASE}/search?query=${encodeURIComponent(keyword)}&per_page=1&page=${randomPage}`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.warn(`Pexels API error: ${response.status}`);
      return `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;
    }

    const data: PexelsResponse = await response.json();
    
    if (!data.photos || data.photos.length === 0) {
      console.warn(`No images found for keyword: ${keyword}`);
      return `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;
    }

    return data.photos[0].src.large || data.photos[0].src.medium;
  } catch (error) {
    console.error('Error fetching from Pexels:', error);
    return `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;
  }
}

/**
 * Get multiple image URLs from Pexels
 */
export async function getPexelsImagesUrls(keywords: string[]): Promise<string[]> {
  const urls = await Promise.all(
    keywords.map(keyword => getPexelsImageUrl(keyword))
  );
  return urls;
}
