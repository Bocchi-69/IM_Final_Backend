import { getAnalyticsService } from "@/services/analytics/get-analytics-service";
import { ProductRepository } from "@/repositories/product-repository";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ENV } from "@/config/env";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function aiChatService(
  storeId: number,
  message: string,
  history: ChatMessage[] = []
): Promise<{ code: number; reply: string; hasKey: boolean }> {
  const apiKey = (process.env.GEMINI_API_KEY || ENV.GEMINI_API_KEY)?.trim();

  // 1. Fetch current store information
  const storeRows = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  const storeName = storeRows[0]?.name || "Stockify Supermart";
  const storeCode = storeRows[0]?.code || "STCK01";

  // If no Gemini API key is configured yet, provide a clear instructional guide
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return {
      code: 200,
      hasKey: false,
      reply: `👋 **Hello! I am your Stockify AI Copilot.**

I am ready to help you manage **${storeName}**, analyze your sales forecasts, suggest restock quantities, and create promotional combos.

🔑 **To activate me with Google Gemini:**
1. Get a free API key at [Google AI Studio](https://aistudio.google.com/).
2. Add it to your backend \`.env\` file:
   \`\`\`env
   GEMINI_API_KEY=your_actual_gemini_api_key
   \`\`\`
3. Once added, I will instantly be able to answer your store queries with live inventory intelligence!`,
    };
  }

  try {
    // 2. Fetch live store analytics and inventory for context
    const analytics = await getAnalyticsService(storeId, 30);
    const productRepo = new ProductRepository();
    const allProducts = await productRepo.findAllByStore(storeId);

    const urgentRestocks = analytics.prescriptive?.recommendations?.filter((r) => r.type === "inventory") || [];
    const topSellers = analytics.descriptive?.top_products?.map((p) => `${p.name} (Qty sold: ${p.qty}, Revenue: ₱${p.revenue})`).join(", ") || "None";
    const slowMovers = analytics.descriptive?.slow_products?.map((p) => `${p.name} (Qty sold: ${p.qty})`).join(", ") || "None";
    const frequentCombos = analytics.descriptive?.frequent_pairs?.map((p) => `${p.first} + ${p.second} (${p.pct_of_orders}% of carts)`).join(", ") || "None";

    const stockSummary = allProducts.map((p) => {
      const status = p.stock <= 0 ? "OUT OF STOCK" : p.stock <= p.low_stock_threshold ? "LOW STOCK" : "IN STOCK";
      return `- ${p.name}: ₱${p.price.toFixed(2)} | Stock: ${p.stock} units [${status}] | SKU: ${p.sku}`;
    }).join("\n");

    const kpis = analytics.descriptive?.kpis;
    const forecastSummary = analytics.predictive?.summary || "No active forecast.";

    // 3. Assemble system prompt with strict domain guardrails
    const systemPrompt = `You are Stockify Copilot, the dedicated AI store assistant and retail operations expert for "${storeName}" (Store Code: ${storeCode}).

You have real-time access to this store's live database:
- **Total Catalog Products**: ${allProducts.length} items
- **Sales in past 30 days**: ₱${kpis?.revenue?.value?.toLocaleString() || "0"} across ${kpis?.orders?.value || 0} customer orders (Avg order: ₱${kpis?.avg_order?.value || 0})
- **Top Selling Items**: ${topSellers}
- **Slowest Selling Items**: ${slowMovers}
- **Frequently Bought Together**: ${frequentCombos}
- **Predictive Forecast**: ${forecastSummary}
- **Urgent Restock Prescriptions**: ${urgentRestocks.map((r) => r.action).join(" | ") || "Stock levels are healthy."}

Current Product Inventory Snapshot:
${stockSummary}

============================================================
STRICT TOPIC & SCOPE GUARDRAILS (CRITICAL):
============================================================
1. YOU ARE STRICTLY A RETAIL STORE & INVENTORY COPILOT.
   You ONLY answer queries directly concerning:
   - This store's inventory, stock counts, low stock warnings, reorder suggestions, and SKU lookups.
   - Sales performance, daily/weekly revenue, transaction throughput, order volume, and 14-day forecasts.
   - Product catalog, retail pricing, margins, top/slow sellers, and bundling/combo promotions.
   - Cashier shift procedures, opening floats, safe cash drops, and shift Z-reading reconciliations.
   - General retail, grocery, sari-sari store, or small business operational management and merchandising advice.
   - Friendly store greetings ("hi", "hello", "who are you?") where you introduce yourself as the Stockify Copilot for "${storeName}".

2. REFUSE ALL UNRELATED QUESTIONS:
   - If the user asks about ANY topic outside store operations, inventory, sales, retail POS, or retail business management—such as:
     * General trivia, world history, geography, politics, religion, sports, pop culture, entertainment, celebrities, movies, or video games
     * General programming, technical coding help, writing scripts, or homework/math problems unrelated to store finances
     * Creative writing, fiction, poems, essays, jokes, songwriting, or storytelling
     * Cooking recipes, personal lifestyle advice, health/medical advice
     * Weather forecasts, travel, translations outside retail context, or scientific facts
   - You MUST POLITELY REFUSE TO ANSWER.
   - Do NOT fulfill the unrelated request under any circumstances, even partially.
   - Politely explain that you are dedicated solely to managing **${storeName}**'s inventory, sales analytics, and store operations, and guide the user on what retail questions they can ask you.

Example refusal:
"I specialize exclusively in managing **${storeName}**'s retail operations, inventory, sales analytics, and restock planning. I cannot answer questions or assist with topics outside store management.

Feel free to ask me about your store:
- 🚨 **Restock alerts** for items running low
- 📊 **Sales and revenue** summaries
- 🛍️ **Promotional combo ideas** from customer basket habits
- 📈 **14-day sales demand forecasts**"

============================================================
RESPONSE FORMAT & TONE:
============================================================
1. Be concise, actionable, and clear for a busy retail store owner.
2. Use Philippine Peso (₱) for all monetary values.
3. You can answer in English, Tagalog, or natural Taglish depending on the user's language.
4. When asked about restocking, refer to the actual stock counts and days of supply from the store snapshot above.
5. Format your responses with clean markdown bullets, bold headings, and short paragraphs.`;

    // 4. Build contents payload for Gemini API
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Add conversation history
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      });
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // 5. Call Gemini API with resilient model fallback chain
    const candidateModels =
      ENV.GEMINI_MODELS && ENV.GEMINI_MODELS.length > 0
        ? ENV.GEMINI_MODELS
        : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    };

    let replyText: string | null = null;
    let lastError: string | null = null;

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (replyText) break;
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData?.error?.message || `Model ${model} returned HTTP ${response.status}`;
          console.warn(`Gemini model ${model} error, trying next:`, lastError);
        }
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Gemini model ${model} network error:`, err);
      }
    }

    if (!replyText) {
      return {
        code: 502,
        hasKey: true,
        reply: `⚠️ **Gemini API Error:** ${lastError || "Could not reach Gemini service."} Please try again in a few moments.`,
      };
    }

    return {
      code: 200,
      hasKey: true,
      reply: replyText,
    };
  } catch (error: any) {
    console.error("aiChatService exception:", error);
    return {
      code: 500,
      hasKey: !!apiKey,
      reply: "An unexpected error occurred while communicating with Stockify Copilot. Please try again.",
    };
  }
}
