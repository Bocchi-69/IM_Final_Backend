import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";

export class SchemaMiddleware {
  public validate = (schema: ZodType) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        // Attach parsed back to req so controllers receive cleaned types if needed
        if ((parsed as any).body) req.body = (parsed as any).body;
        return next();
      } catch (error) {
        if (error instanceof ZodError) {
          const errorsMap: Record<string, string[]> = {};
          error.issues.forEach((issue) => {
            const field = issue.path.slice(1).join(".") || issue.path.join(".") || "error";
            if (!errorsMap[field]) errorsMap[field] = [];
            errorsMap[field].push(issue.message);
          });

          return res.status(422).json({
            status: "error",
            message: error.issues[0]?.message || "Validation failed",
            errors: errorsMap,
          });
        }
        return next(error);
      }
    };
}
