// Pre-made database of high-quality Pexels images to speed up generation
// These are real image URLs that don't require API calls during generation

export const IMAGE_DATABASE = [
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3714896/pexels-photo-3714896.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3808517/pexels-photo-3808517.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3975517/pexels-photo-3975517.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3930986/pexels-photo-3930986.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3962286/pexels-photo-3962286.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3857885/pexels-photo-3857885.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3808514/pexels-photo-3808514.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3913025/pexels-photo-3913025.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3808516/pexels-photo-3808516.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3755681/pexels-photo-3755681.jpeg?auto=compress&cs=tinysrgb&w=600',
];

/**
 * Get specific images from the database (not random)
 */
export function getRandomImages(count: number = 3): string[] {
  return IMAGE_DATABASE.slice(0, count);
}
