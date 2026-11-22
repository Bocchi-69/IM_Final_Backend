import type { Request, Response } from "express";
import { getAuthContext, AuthenticatedRequest } from "@/middlewares/auth-middleware";
import { aiChatService } from "@/services/ai/ai-chat-service";

export class AiController {
  public chat = async (req: Request, res: Response) => {
    try {
      const auth = getAuthContext(req);
      if (!auth) {
        return res.status(403).json({
          code: 403,
          status: "error",
          message: "Forbidden: No store assigned to this account.",
        });
      }

      const role = (req as AuthenticatedRequest).user?.role;
      if (role !== "owner") {
        return res.status(403).json({
          code: 403,
          status: "error",
          message: "Access forbidden. AI Copilot is restricted to store owners.",
        });
      }

      const { message, history } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(422).json({
          code: 422,
          status: "error",
          message: "A non-empty message is required.",
        });
      }

      const result = await aiChatService(auth.storeId, message.trim(), Array.isArray(history) ? history : []);
      return res.status(200).json({
        code: 200,
        status: "success",
        reply: result.reply,
        hasKey: result.hasKey,
      });
    } catch (error) {
      console.error("AiController error:", error);
      return res.status(500).json({
        code: 500,
        status: "error",
        message: "Failed to process chat message",
      });
    }
  };
}
