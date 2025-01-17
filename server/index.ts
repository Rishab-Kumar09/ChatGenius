import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { users } from "@db/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for Replit deployment
app.use((req, res, next) => {
  const replit_domain = process.env.REPL_SLUG ? `.${process.env.REPL_OWNER}.repl.co` : undefined;
  if (replit_domain) {
    res.header('Access-Control-Allow-Origin', `https://${process.env.REPL_SLUG}${replit_domain}`);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  next();
});

// Add production logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Test database connection before starting server
    console.log('Connecting to database...', process.env.DATABASE_URL);
    await db.select({
      id: users.id,
      username: users.username
    }).from(users).limit(1);
    log('Database connection successful');

    const server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Don't send stack traces in production
      const error = app.get("env") === "production"
        ? { message }
        : { message, stack: err.stack };

      res.status(status).json(error);

      // Still log the full error on the server
      console.error('Server error:', err);
    });

    // Setup static file serving or Vite middleware based on environment
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Use Replit's port and bind to all interfaces
    const PORT = parseInt(process.env.PORT || "5000", 10);
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running in ${app.get("env")} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();