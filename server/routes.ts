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

  // Get all projects for user
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userProjects = await storage.getUserProjects(userId);
      res.json(userProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Create new project
  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { name, data } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Project name required" });
      }
      const newProject = await storage.createProject({
        userId,
        name,
        data: data || { screens: [] }
      });
      res.json(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Update project
  app.patch('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.params;
      const { name, data } = req.body;
      
      const project = await storage.getProject(id, userId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const updated = await storage.updateProject(id, userId, data || project.data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating project:", error);
      if (error.message === "Unauthorized") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Delete project
  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.params;
      
      await storage.deleteProject(id, userId);
      res.json({ message: "Project deleted" });
    } catch (error: any) {
      console.error("Error deleting project:", error);
      if (error.message === "Unauthorized") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: "Failed to delete project" });
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

      // Generate random images from Unsplash - fresh images every time
      const imageUrls = getRandomImages(3);
      
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

      // Validate and fix empty image placeholders
      const validatedHtml = extractedHtml.map(html => fillEmptyImages(html, imageUrls));

      // Check if designs have enough images - if not, reject and ask to regenerate
      for (const html of validatedHtml) {
        const imgCount = (html.match(/<img[^>]+src=["'](?!["'])([^"']+)["']/gi) || []).length;
        if (imgCount === 0) {
          console.log(`[Generation] Design has no images, requesting regeneration...`);
          return res.status(400).json({ error: "Design must include at least 2 images. Please try again." });
        }
      }

      console.log(`[Generation] Extracted ${validatedHtml.length} screen(s)`);
      res.json({ screens: validatedHtml });
    } catch (error: any) {
      console.error('Generation error:', error);
      res.status(500).json({ error: error.message || 'Generation failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

/**
 * Fill empty or placeholder images with valid URLs from database
 */
function fillEmptyImages(html: string, imageUrls: string[]): string {
  if (imageUrls.length === 0) return html;
  
  let result = html;
  let imageIndex = 0;
  
  // 1. Replace img tags with missing src attribute completely
  result = result.replace(/<img\s+([^>]*)(?!src)([^>]*)>/gi, (match) => {
    if (imageIndex < imageUrls.length) {
      return `<img src="${imageUrls[imageIndex++]}" ${match.replace(/<img\s+/, '').replace(/>/, '')}>`;
    }
    return match;
  });
  
  // 2. Replace empty src attributes src="" or src=''
  result = result.replace(/<img\s+([^>]*)src=["']["']([^>]*)>/gi, (match, before, after) => {
    if (imageIndex < imageUrls.length) {
      return `<img ${before}src="${imageUrls[imageIndex++]}"${after}>`;
    }
    return match;
  });
  
  // 3. Replace common placeholder values
  const placeholders = ['placeholder', 'undefined', 'null', 'none', '#', 'image', 'photo', '/image', '/photo', 'img', 'picture', 'src'];
  placeholders.forEach(placeholder => {
    const regex = new RegExp(`src=["']${placeholder}["']`, 'gi');
    result = result.replace(regex, () => {
      if (imageIndex < imageUrls.length) {
        return `src="${imageUrls[imageIndex++]}"`;
      }
      return `src="${imageUrls[imageIndex % imageUrls.length]}"`;
    });
  });
  
  // 4. Find any remaining img tags without valid URLs and add them
  const imgRegex = /<img[^>]*>/gi;
  const matches = result.match(imgRegex) || [];
  matches.forEach((match) => {
    if (!match.includes('source.unsplash.com') && !match.includes('images.pexels.com')) {
      const hasValidSrc = /src=["'](?!["'])(https?:\/\/|data:)/.test(match);
      if (!hasValidSrc) {
        const newSrc = imageUrls[imageIndex % imageUrls.length];
        if (imageIndex < imageUrls.length) imageIndex++;
        result = result.replace(match, match.replace(/>$/, ` src="${newSrc}">`));
      }
    }
  });
  
  return result;
}


function getSystemPrompt(screenCount: number, platform: string, features: string[], imageUrls: string[] = []) {
  return `
You are a specialized UI Generator that creates beautiful, realistic designs with REQUIRED imagery and emojis.
TASK: Generate ${screenCount} screen(s) of high-quality, production-ready HTML/Tailwind CSS based on the user's prompt.

**IMAGE URLS - COPY AND PASTE THESE EXACTLY INTO YOUR HTML:**
${imageUrls.map((url, i) => `Image ${i + 1}: ${url}`).join('\n')}

**CRITICAL RULES - MUST FOLLOW:**
1. **OUTPUT RAW HTML ONLY.** Do not wrap in JSON. Use Markdown code blocks ONLY for readability: \`\`\`html ... \`\`\`.
2. **FORMAT:** Generate ${screenCount} DISTINCT screens. Wrap each screen's HTML code in a standard Markdown code block like this:
   
   \`\`\`html
   <!-- Screen: [A Unique Name for Screen] -->
   <div class="w-full h-full min-h-screen bg-white [styles]">
      <img src="${imageUrls[0]}" alt="image" style="width: 100%; height: auto;">
      ... content ...
   </div>
   \`\`\`
   
3. **EMOJIS - PRIMARY FOCUS, 100% MANDATORY IN EVERY DESIGN:**
   - ADD LOTS OF EMOJIS TO EVERY DESIGN - they are PRIMARY visual elements that make designs engaging
   - Use emojis extensively in headings, buttons, section titles, and throughout the design
   - Use emojis as section dividers, bullet points, icons, and visual accents everywhere
   - Include contextual emojis: 🎨 for art, 📊 for analytics, 💰 for pricing, 🎯 for goals, 👥 for team, 🚀 for growth, 💡 for ideas, ⭐ for ratings, ✅ for success, etc.
   - Minimum 15-20+ emojis spread throughout each design
   - Emojis should be large and prominent - use them as visual replacements for icons
   - Use emoji combinations: 🎉✨🚀, 💡🔥⚡, etc.
   - Emojis enhance visual hierarchy and make the design fun and engaging

4. **IMAGES - 100% MANDATORY (USE THE URLS ABOVE):**
   - EVERY DESIGN MUST INCLUDE 2-3 REAL IMAGES
   - Paste these URLs EXACTLY as shown above: ${imageUrls.join(', ')}
   - Place images prominently in hero sections, backgrounds, feature showcases
   - NEVER create empty images: NO src="", NO src=undefined, NO src="#", NO missing src attributes
   - NEVER use placeholder text like "image", "photo", "placeholder" in src
   - CRITICAL: COPY THE URLs ABOVE EXACTLY AND PASTE THEM INTO <img src="..."> TAGS
   - Example: <img src="${imageUrls[0]}" alt="image">

5. **LAYOUT:** The root div MUST have 'w-full h-full min-h-screen' to fill the frame.
6. **CONTENT:** Make it look realistic. Fill text with relevant content. Add depth with shadows and layering.
7. **STYLING:** Use Tailwind CSS extensively. Include hover effects, transitions, and visual polish.
8. **NO JAVASCRIPT.** Pure HTML/CSS structure only.
9. **DOUBLE-CHECK BEFORE SUBMITTING:** Review every <img> tag. Make sure EVERY img tag has a valid src URL from the list above. NO EMPTY src="" attributes allowed.

User Prompt Context: ${platform} Application.
FEATURES: ${features.join(', ') || 'Modern UI'}.

**FINAL WARNING:** If ANY <img> tag has an empty or invalid src, the entire design will be rejected. COPY AND PASTE the image URLs exactly.
Make your designs STUNNING with beautiful, real imagery AND EMOJIS.
`;
}
