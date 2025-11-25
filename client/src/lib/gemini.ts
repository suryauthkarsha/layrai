import { fetchWithRetry } from './export-utils';

// Call backend API to generate UI
export const generateUI = async (
  prompt: string, 
  screenCount: number, 
  platform: string
): Promise<string[]> => {
  const response = await fetchWithRetry(
    '/api/generate-ui',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        screenCount,
        platform
      })
    }
  );

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.screens || !Array.isArray(data.screens)) {
    throw new Error("Invalid response from server");
  }

  return data.screens;
};
