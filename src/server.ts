import app from "@/app";
import { ENV } from "@/config/env";

const startServer = () => {
  try {
    const port = Number(process.env.PORT) || ENV.PORT || 10000;
    const host = "0.0.0.0";

    const server = app.listen(port, host, () => {
      console.log("--------------------------------------------------");
      console.log(`🚀 ${ENV.APP_NAME} started successfully!`);
      console.log(`📡 URL: ${ENV.BACKEND_URL}`);
      console.log(`🌍 MODE: ${ENV.NODE_ENV}`);
      console.log(`🔌 Listening on http://${host}:${port}`);
      console.log("--------------------------------------------------");
    });

    server.on("error", (err: unknown) => {
      console.error("❌ CRITICAL: Server listen error:", err);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ CRITICAL: Could not start server:", error);
    process.exit(1);
  }
};

startServer();
