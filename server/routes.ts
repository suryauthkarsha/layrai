import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Generation API endpoint
  app.post("/api/generate-ui", async (req, res) => {
    try {
      const { prompt, screenCount, platform } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }

      const systemPrompt = getSystemPrompt(screenCount || 1, platform || 'mobile', []);

      const response = await fetch(
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        return res.status(response.status).json({ error: `Gemini API error: ${response.status}` });
      }

      const data = await response.json();
      if (!data.candidates || !data.candidates.length) {
        return res.status(500).json({ error: "No content generated" });
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

      res.json({ screens: extractedHtml });
    } catch (error: any) {
      console.error('Generation error:', error);
      res.status(500).json({ error: error.message || 'Generation failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function getSystemPrompt(screenCount: number, platform: string, features: string[]) {
  return `
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
}
