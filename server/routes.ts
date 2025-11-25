import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getRandomImages } from "./lib/image-db";

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

      // Use pre-made image database (no API call needed - speeds up generation!)
      const imageUrls = getRandomImages(Math.min(3, screenCount || 1));
      
      const systemPrompt = getSystemPrompt(screenCount || 1, platform || 'mobile', [], imageUrls);

      console.log(`[Generation] Starting UI generation for ${screenCount} screen(s)...`);
      const startTime = Date.now();

      const ai = new GoogleGenAI({ apiKey });
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUSER REQUEST: "${prompt}"`
          }]
        }]
      });

      const generationTime = Date.now() - startTime;
      console.log(`[Generation] AI response received in ${generationTime}ms`);

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

      console.log(`[Generation] Extracted ${extractedHtml.length} screen(s)`);
      res.json({ screens: extractedHtml });
    } catch (error: any) {
      console.error('Generation error:', error);
      res.status(500).json({ error: error.message || 'Generation failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function getSystemPrompt(screenCount: number, platform: string, features: string[], imageUrls: string[] = []) {
  const imageExamples = imageUrls.length > 0 
    ? `\n**REAL IMAGE URLS TO USE (MUST USE THESE - copy and paste exactly):**\n${imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n\nYOU MUST USE THESE EXACT URLS IN <img> TAGS - DO NOT MODIFY THEM.`
    : '';
  
  return `
You are a specialized UI Generator that creates beautiful, realistic designs with REQUIRED imagery.
TASK: Generate ${screenCount} screen(s) of high-quality, production-ready HTML/Tailwind CSS based on the user's prompt.

**CRITICAL RULES - MUST FOLLOW:**
1. **OUTPUT RAW HTML ONLY.** Do not wrap in JSON. Use Markdown code blocks ONLY for readability: \`\`\`html ... \`\`\`.
2. **FORMAT:** Generate ${screenCount} DISTINCT screens. Wrap each screen's HTML code in a standard Markdown code block like this:
   
   \`\`\`html
   <!-- Screen: [A Unique Name for Screen] -->
   <div class="w-full h-full min-h-screen bg-white [styles]">
      ... content ...
   </div>
   \`\`\`
   
3. **IMAGES - 100% MANDATORY, NEVER SKIP:**
   - YOU MUST INCLUDE 2-4 IMAGES IN EVERY SCREEN using the provided Pexels URLs below
   - Use REAL image URLs provided below - do not make up URLs or use empty src attributes
   - Place images prominently in the design (hero section, cards, backgrounds)
   - Example: <img src="https://images.pexels.com/photos/..." class="w-full h-64 object-cover rounded-lg" alt="description" />
   - OR use CSS gradients: <div class="w-full h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
   - OR use SVG icons inline
   - ABSOLUTELY NO empty img tags, NO missing src attributes, NO placeholder divs
   - If you don't include images, the design is INCOMPLETE and REJECTED

4. **LAYOUT:** The root div MUST have 'w-full h-full min-h-screen' to fill the frame.
5. **CONTENT:** Make it look realistic. Fill text with relevant content. Add depth with shadows and layering.
6. **STYLING:** Use Tailwind CSS extensively. Include hover effects, transitions, and visual polish.
7. **NO JAVASCRIPT.** Pure HTML/CSS structure only.

User Prompt Context: ${platform} Application.
FEATURES: ${features.join(', ') || 'Modern UI'}.

${imageExamples}

**WARNING:** Every <img> tag MUST have a valid src URL. Empty img tags or placeholder divs will cause rejection.
Make your designs STUNNING with beautiful, real imagery.
`;
}
