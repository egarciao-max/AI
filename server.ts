import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import cors from "cors";
import { Resend } from "resend";

const db = new Database("family_ai.db");

// Initialize database with the full schema from the prompt
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'pending',
    password_hash TEXT,
    age INTEGER,
    parent_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{"model": "gemini-3-flash-preview", "temperature": 0.7}',
    agent_personality JSONB DEFAULT '{"tono": "amigable"}',
    limits JSONB DEFAULT '{"daily_messages": 20, "used_today": 0}'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    token TEXT UNIQUE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS twofa_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    code TEXT,
    expires_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_threads (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    model_used TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    theme TEXT DEFAULT 'extreme',
    notifications_enabled INTEGER DEFAULT 1,
    language TEXT DEFAULT 'es',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS api_configs (
    key_name TEXT PRIMARY KEY,
    key_value TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT,
    subject TEXT,
    status TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocked_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS admin_generated_images (
    id TEXT PRIMARY KEY,
    admin_id TEXT,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    aspect_ratio TEXT DEFAULT '16:9',
    image_size TEXT DEFAULT '1K',
    search_grounding INTEGER DEFAULT 0,
    thinking TEXT,
    image_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES users(id)
  );
`);

// Seed an admin user with the correct domain
const adminEmail = process.env.ADMIN_EMAIL || "quique@oropezas.com";
const seedAdmin = db.prepare("INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)");
seedAdmin.run("admin-1", "Enrique Admin", adminEmail, "admin");

// Seed some blocked terms
const seedBlocked = db.prepare("INSERT OR IGNORE INTO blocked_terms (term) VALUES (?)");
['spam', 'malware', 'offensive'].forEach(term => seedBlocked.run(term));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));

  // Mock Auth Middleware
  const authMiddleware = (req: any, res: any, next: any) => {
    const userEmail = req.headers['x-user-email'] || adminEmail;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(userEmail) as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = user;
    next();
  };

  const adminMiddleware = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.email !== adminEmail) {
      return res.status(403).json({ error: "Only administrators can perform this action" });
    }
    next();
  };

  // API Routes
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, secretCode } = req.body;
    if (secretCode !== process.env.FAMILY_SECRET_CODE) {
      return res.status(403).json({ error: "Invalid family secret code" });
    }
    
    try {
      const id = Math.random().toString(36).substring(2, 15);
      // In a real app, we'd hash the password with process.env.PASSWORD_SALT
      db.prepare("INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)")
        .run(id, name, email, 'user');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: "User already exists or invalid data" });
    }
  });

  app.get("/api/user/me", authMiddleware, (req: any, res) => {
    const preferences = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(req.user.id);
    res.json({ ...req.user, preferences });
  });

  app.put("/api/user/preferences", authMiddleware, (req: any, res) => {
    const { theme, notifications_enabled, language } = req.body;
    db.prepare(`
      INSERT INTO user_preferences (user_id, theme, notifications_enabled, language)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        notifications_enabled = excluded.notifications_enabled,
        language = excluded.language
    `).run(req.user.id, theme, notifications_enabled ? 1 : 0, language);
    res.json({ success: true });
  });

  // Admin Stats (Expanded)
  app.get("/api/admin/stats", authMiddleware, adminMiddleware, (req: any, res) => {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    const threadCount = db.prepare("SELECT COUNT(*) as count FROM chat_threads").get() as any;
    const messageCount = db.prepare("SELECT COUNT(*) as count FROM chat_messages").get() as any;
    const imageStats = db.prepare(`
      SELECT 
        COUNT(*) as total_images,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_images
      FROM admin_generated_images
    `).get() as any;

    res.json({
      users: userCount.count,
      threads: threadCount.count,
      messages: messageCount.count,
      images: {
        total: imageStats.total_images || 0,
        today: imageStats.today_images || 0,
        cost: (imageStats.total_images * 0.03).toFixed(2)
      }
    });
  });

  app.post("/api/admin/test-email", authMiddleware, adminMiddleware, async (req: any, res) => {
    const { to } = req.body;
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "Resend API key not configured" });
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const { data, error } = await resend.emails.send({
        from: 'Familia AI <onboarding@resend.dev>',
        to: to || adminEmail,
        subject: 'Familia AI - Test Email',
        html: '<p>This is a professional test email from <strong>Familia AI</strong>!</p>'
      });
      
      if (error) throw error;
      
      db.prepare("INSERT INTO email_logs (recipient, subject, status) VALUES (?, ?, ?)")
        .run(to || adminEmail, 'Test Email', 'sent');
        
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Chat Endpoints
  app.get("/api/chats", authMiddleware, (req: any, res) => {
    const threads = db.prepare("SELECT * FROM chat_threads WHERE user_id = ? ORDER BY last_message_at DESC").all(req.user.id);
    res.json(threads);
  });

  app.get("/api/chats/:id", authMiddleware, (req: any, res) => {
    const messages = db.prepare("SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC").all(req.params.id);
    res.json(messages);
  });

  app.post("/api/chat", authMiddleware, async (req: any, res) => {
    try {
      const { message, threadId: existingThreadId } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      // Check for blocked terms
      const blocked = db.prepare("SELECT term FROM blocked_terms").all() as any[];
      if (blocked.some(b => message.toLowerCase().includes(b.term.toLowerCase()))) {
        return res.status(400).json({ error: "Message contains blocked terms" });
      }

      let threadId = existingThreadId;
      if (!threadId) {
        threadId = Math.random().toString(36).substring(2, 15);
        db.prepare("INSERT INTO chat_threads (id, user_id, title, model_used) VALUES (?, ?, ?, ?)")
          .run(threadId, req.user.id, message.substring(0, 30), "gemini-3-flash-preview");
      }

      // Save user message
      db.prepare("INSERT INTO chat_messages (id, thread_id, role, content) VALUES (?, ?, ?, ?)")
        .run(Math.random().toString(36).substring(2, 15), threadId, 'user', message);

      // Get context (last 10 messages)
      const history = db.prepare("SELECT role, content FROM chat_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 10").all(threadId);
      const contents = history.reverse().map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Call Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: `Eres Familia AI, un asistente inteligente para la familia Oropeza. Tu tono es amigable, divertido y cercano. Estás en el dominio ai.oropezas.com. Ayudas con tareas, das consejos y compartes curiosidades.`,
        }
      });

      const aiResponse = response.text;

      // Save AI message
      db.prepare("INSERT INTO chat_messages (id, thread_id, role, content) VALUES (?, ?, ?, ?)")
        .run(Math.random().toString(36).substring(2, 15), threadId, 'assistant', aiResponse);

      // Update thread timestamp
      db.prepare("UPDATE chat_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?").run(threadId);

      // Log security action
      db.prepare("INSERT INTO security_logs (user_id, action, ip_address) VALUES (?, ?, ?)")
        .run(req.user.id, "chat_message_sent", req.ip);

      res.json({ response: aiResponse, threadId });

    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Image Endpoints (Admin Only)
  app.post("/api/images/generations", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { prompt, aspectRatio = '16:9', imageSize = '1K', model = 'gemini-3-pro-image-preview', useGoogleSearch = false } = req.body;

      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: { aspectRatio, imageSize },
          tools: useGoogleSearch ? [{ googleSearch: {} }] : undefined,
        },
      });

      let imageBase64 = null;
      let thinking = null;

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
            imageBase64 = part.inlineData.data;
          }
          if (part.text) thinking = part.text;
        }
      }

      if (imageBase64) {
        const id = Math.random().toString(36).substring(2, 15);
        db.prepare(`
          INSERT INTO admin_generated_images (id, admin_id, prompt, model, aspect_ratio, image_size, search_grounding, thinking, image_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.user.id, prompt, model, aspectRatio, imageSize, useGoogleSearch ? 1 : 0, thinking, imageBase64);
      }

      res.json({
        success: true,
        image: imageBase64 ? `data:image/png;base64,${imageBase64}` : null,
        thinking,
        model_used: model
      });

    } catch (error: any) {
      console.error("Image generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/images", authMiddleware, adminMiddleware, (req: any, res) => {
    const images = db.prepare(`
      SELECT i.*, u.name as admin_name, u.email as admin_email 
      FROM admin_generated_images i
      JOIN users u ON i.admin_id = u.id
      ORDER BY i.created_at DESC
    `).all();
    res.json(images);
  });

  app.get("/api/admin/images/stats", authMiddleware, adminMiddleware, (req: any, res) => {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_images,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_images
      FROM admin_generated_images
    `).get() as any;

    res.json({
      total_images: stats.total_images || 0,
      today_images: stats.today_images || 0,
      estimated_cost_usd: (stats.total_images * 0.03).toFixed(2)
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
