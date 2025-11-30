import { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import type { Express } from "express";
import { registerRoutes } from "../server/routes";

const app = express();
app.use(express.json());

let serverInitialized = false;

export default async (req: VercelRequest, res: VercelResponse) => {
  if (!serverInitialized) {
    await registerRoutes(null as any, app);
    serverInitialized = true;
  }

  return new Promise((resolve) => {
    app(req as any, res as any);
    res.on("finish", resolve);
  });
};
