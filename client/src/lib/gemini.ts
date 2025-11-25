import { fetchWithRetry } from './export-utils';

// Get system prompt for Gemini
export const getSystemPrompt = (screenCount: number, platform: string, features: string[]) => `
You are a specialized UI Generator.
TASK: Generate ${screenCount} screen(s) of high-quality, production-ready HTML/Tailwind CSS based on the user's prompt.

**RULES:**
1. **OUTPUT RAW HTML ONLY.** Do not wrap in JSON. Use Markdown code blocks ONLY for readability: \`\`\`html ... \`\`\`.
2. **FORMAT:** Generate ${screenCount} DISTINCT screens. Wrap each screen's HTML code in a standard Markdown code block like this:
   
   \`\`\`html
   <!-- Screen: [A Unique Name for Screen] -->
   <div class="w-full h-full min-h-screen bg-white [styles]">
      ... content ...
   </div>
   \`\`\`
   
3. **IMAGES:** Use 'https://source.unsplash.com/random/800x600/?keyword' (replace keyword) or CSS gradients. NEVER leave src empty.
4. **LAYOUT:** The root div MUST have 'w-full h-full min-h-screen' to fill the frame.
5. **CONTENT:** Make it look realistic. Fill text with relevant placeholders.
6. **NO JAVASCRIPT.** Pure HTML/CSS structure.

User Prompt Context: ${platform} Application.
FEATURES: ${features.join(', ') || 'Modern UI'}.
`;

// Call Gemini API to generate UI
export const generateUI = async (
  prompt: string, 
  screenCount: number, 
  platform: string,
  apiKey: string
): Promise<string[]> => {
  const systemPrompt = getSystemPrompt(screenCount, platform, []);
  
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUSER REQUEST: "${prompt}"`
          }]
        }]
      })
    }
  );

  const data = await response.json();
  if (!data.candidates || !data.candidates.length) {
    throw new Error("No content generated");
  }

  const text = data.candidates[0].content.parts[0].text;

  // Extract HTML code blocks
  const htmlBlockRegex = /```html\n([\s\S]*?)```/g;
  const extractedHtml: string[] = [];
  let match;

  while ((match = htmlBlockRegex.exec(text)) !== null) {
    extractedHtml.push(match[1].trim());
  }

  // Fallback: If no blocks found, try to extract raw HTML
  if (extractedHtml.length === 0) {
    const firstDiv = text.indexOf('<div');
    const lastDiv = text.lastIndexOf('</div>');
    if (firstDiv !== -1 && lastDiv !== -1 && lastDiv > firstDiv) {
      const rawHtml = text.substring(firstDiv, lastDiv + 6).trim();
      extractedHtml.push(rawHtml);
    }
  }

  return extractedHtml;
};
