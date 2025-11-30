// Authentication Middleware - Validación de API Key
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { ApiKey } from "@shared/schema";

// Extender Request para incluir apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

// Middleware de autenticación por API Key
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

  if (!apiKeyHeader) {
    res.status(401).json({
      success: false,
      error: "API key requerida",
      code: "MISSING_API_KEY",
      message: "Debes incluir el header 'x-api-key' con tu API key",
    });
    return;
  }

  try {
    const apiKey = await storage.validateApiKey(apiKeyHeader);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: "API key inválida",
        code: "INVALID_API_KEY",
        message: "La API key proporcionada no es válida o está desactivada",
      });
      return;
    }

    // Verificar IP si hay restricciones
    if (apiKey.allowedIps && apiKey.allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || "";
      const isAllowed = apiKey.allowedIps.some(
        (ip) => ip === clientIp || ip === "*"
      );

      if (!isAllowed) {
        res.status(403).json({
          success: false,
          error: "IP no autorizada",
          code: "IP_NOT_ALLOWED",
          message: "Tu IP no está autorizada para usar esta API key",
        });
        return;
      }
    }

    // Adjuntar API key al request
    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error("Error validando API key:", error);
    res.status(500).json({
      success: false,
      error: "Error de autenticación",
      code: "AUTH_ERROR",
      message: "Error interno al validar la API key",
    });
  }
}

// Middleware opcional - no falla si no hay API key
export async function optionalApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

  if (apiKeyHeader) {
    try {
      const apiKey = await storage.validateApiKey(apiKeyHeader);
      if (apiKey) {
        req.apiKey = apiKey;
      }
    } catch (error) {
      console.error("Error validando API key opcional:", error);
    }
  }

  next();
}
