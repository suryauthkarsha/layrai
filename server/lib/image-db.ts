// Generate random Unsplash URLs for images
// Each URL is unique and pulls from Unsplash's vast image library

export const IMAGE_DATABASE: string[] = [];

/**
 * Generate random Unsplash image URLs
 * Returns fresh random images from Unsplash each time
 */
export function getRandomImages(count: number = 3): string[] {
  const images: string[] = [];
  const keywords = ['business', 'design', 'technology', 'nature', 'landscape', 'workspace', 'creative', 'modern'];
  
  for (let i = 0; i < count; i++) {
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    const randomId = Math.random().toString(36).substring(2, 15);
    // Using Unsplash's random image endpoint with keywords for variety
    images.push(`https://source.unsplash.com/random/800x600?${keyword}&t=${randomId}`);
  }
  
  return images;
}
