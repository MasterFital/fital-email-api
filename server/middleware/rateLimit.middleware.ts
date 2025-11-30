// Rate Limiting Middleware - Control de límite de requests
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// Configuración de rate limits
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10); // 1 minuto
const RATE_LIMIT_MAX_PER_KEY = parseInt(process.env.RATE_LIMIT_MAX_PER_KEY || "100", 10);
const RATE_LIMIT_MAX_GLOBAL = parseInt(process.env.RATE_LIMIT_MAX_GLOBAL || "1000", 10);

// Función para obtener key del rate limiter
function getApiKeyFromRequest(req: Request): string {
  const apiKey = req.headers["x-api-key"] as string;
  if (apiKey) {
    // Usar solo el prefijo del API key para privacidad en logs
    return `apikey:${apiKey.substring(0, 12)}`;
  }
  // Fallback a un identificador único
  return `unknown:${Date.now()}`;
}

// Rate limiter global - protege contra ataques DDoS
export const globalRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_GLOBAL,
  message: {
    success: false,
    error: "Demasiadas solicitudes",
    code: "RATE_LIMIT_EXCEEDED",
    message: "Has excedido el límite global de solicitudes. Intenta de nuevo en un minuto.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
});

// Rate limiter por API key - límite personalizado por cliente
export const apiKeyRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: (req: Request) => {
    // Si hay override personalizado en el API key, usarlo
    const apiKey = req.apiKey;
    if (apiKey?.rateLimitOverride) {
      return apiKey.rateLimitOverride;
    }
    return RATE_LIMIT_MAX_PER_KEY;
  },
  message: {
    success: false,
    error: "Límite de envíos excedido",
    code: "EMAIL_RATE_LIMIT_EXCEEDED",
    message: `Has excedido el límite de ${RATE_LIMIT_MAX_PER_KEY} emails por minuto. Intenta de nuevo pronto.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getApiKeyFromRequest,
  validate: { xForwardedForHeader: false, ip: false },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    res.status(429).json({
      success: false,
      error: "Límite de envíos excedido",
      code: "EMAIL_RATE_LIMIT_EXCEEDED",
      message: `Has excedido el límite de emails por minuto.`,
      retryAfter,
      limit: req.apiKey?.rateLimitOverride || RATE_LIMIT_MAX_PER_KEY,
    });
  },
});

// Rate limiter para endpoints de lectura (más permisivo)
export const readRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 300, // 300 requests por minuto para lectura
  message: {
    success: false,
    error: "Demasiadas consultas",
    code: "READ_RATE_LIMIT_EXCEEDED",
    message: "Has excedido el límite de consultas. Intenta de nuevo en un minuto.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getApiKeyFromRequest,
  validate: { xForwardedForHeader: false, ip: false },
});

// Rate limiter estricto para operaciones sensibles
export const strictRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS * 5, // 5 minutos
  max: 10, // Solo 10 operaciones cada 5 minutos
  message: {
    success: false,
    error: "Límite de operaciones sensibles excedido",
    code: "STRICT_RATE_LIMIT_EXCEEDED",
    message: "Has excedido el límite de operaciones sensibles. Intenta de nuevo en 5 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getApiKeyFromRequest,
  validate: { xForwardedForHeader: false, ip: false },
});
