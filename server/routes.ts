import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth endpoint to get current user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      res.json(user || null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // AI Generation API endpoint
  app.post("/api/generate-ui", async (req, res) => {
    try {
      const { prompt, screenCount, platform } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }

      // Log key validation with more detail
      const keyStart = apiKey.substring(0, 15);
      const keyEnd = apiKey.substring(apiKey.length - 5);
      console.log(`[API] Using GEMINI_API_KEY (${keyStart}...${keyEnd})`);

      const systemPrompt = getSystemPrompt(screenCount || 1, platform || 'mobile', []);

      const ai = new GoogleGenAI({ apiKey });
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUSER REQUEST: "${prompt}"`
          }]
        }]
      });

      if (!geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(500).json({ error: "No content generated" });
      }

      const text = geminiResponse.candidates[0].content.parts[0].text;

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
You are a specialized UI Generator that creates beautiful, realistic designs with proper imagery.
TASK: Generate ${screenCount} screen(s) of high-quality, production-ready HTML/Tailwind CSS based on the user's prompt.

**CRITICAL RULES:**
1. **OUTPUT RAW HTML ONLY.** Do not wrap in JSON. Use Markdown code blocks ONLY for readability: \`\`\`html ... \`\`\`.
2. **FORMAT:** Generate ${screenCount} DISTINCT screens. Wrap each screen's HTML code in a standard Markdown code block like this:
   
   \`\`\`html
   <!-- Screen: [A Unique Name for Screen] -->
   <div class="w-full h-full min-h-screen bg-white [styles]">
      ... content ...
   </div>
   \`\`\`
   
3. **IMAGES - MANDATORY IN EVERY DESIGN:** ALWAYS include realistic images in your designs. DO NOT skip images.
   - Use Unsplash URLs: 'https://source.unsplash.com/random/800x600/?keyword' (with relevant keywords)
   - OR use CSS gradients with visual interest
   - OR use SVG icons and illustrations (embed them as <svg> tags, not img)
   - NEVER create empty <img> tags or placeholder divs without content
   - EVERY design should have at least 1-3 images/visual assets
4. **LAYOUT:** The root div MUST have 'w-full h-full min-h-screen' to fill the frame.
5. **CONTENT:** Make it look realistic. Fill text with relevant placeholders. Add depth with shadows and layering.
6. **STYLING:** Use Tailwind CSS extensively. Include hover effects, transitions, and visual polish.
7. **NO JAVASCRIPT.** Pure HTML/CSS structure only.

User Prompt Context: ${platform} Application.
FEATURES: ${features.join(', ') || 'Modern UI'}.

**EXAMPLE GOOD IMAGE USAGE:**
<img src="https://source.unsplash.com/random/800x600/?landscape" alt="Hero image" class="w-full h-64 object-cover rounded-lg" />

**EXAMPLE BAD (AVOID):**
<img src="" alt="placeholder" /> <!-- NEVER DO THIS -->
<div></div> <!-- Empty divs are boring -->

Make your designs STUNNING with proper imagery.
`;
}
