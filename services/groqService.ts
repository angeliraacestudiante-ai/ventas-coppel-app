import { TicketAnalysisResult, Brand } from "../types";

export const analyzeTicketWithGroq = async (base64Image: string): Promise<TicketAnalysisResult> => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
        console.warn("⚠️ No se encontró VITE_GROQ_API_KEY. Saltando respaldo de Groq.");
        throw new Error("Falta la API Key de Groq (VITE_GROQ_API_KEY). Agrégala en las Environment Variables de Vercel/Netlify.");
    }

    console.log("🚀 Iniciando respaldo con GROQ (Llama 3.2 Vision)...");

    // Asegurar formato data:image
    const imageUrl = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

    const prompt = `
  You are an expert data extractor. Analyze this ticket image and extract the following in pure JSON format:
  {
    "invoiceNumber": "The unique number (e.g., if '1053 801190', return '801190')",
    "date": "YYYY-MM-DD",
    "customerName": "Customer Name (Title Case)",
    "items": [
      {
        "brand": "Brand Name (SAMSUNG, APPLE, MOTOROLA, XIAOMI, OPPO, ZTE, HONOR, HUAWEI, ALCATEL, OTRO)",
        "price": 1234.56 (Numeric, calculated after subtracting discounts if any)
      }
    ]
  }
  
  IMPORTANT RULES:
  1. Only extract mobile phones. Ignore accessories (chips, cases).
  2. For the price: Look for the base price and subtract any "Descuento por paquete" or similar appearing immediately below it.
  3. JSON ONLY. No markdown, no comments.
  `;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageUrl
                                }
                            }
                        ]
                    }
                ],
                model: "llama-3.2-90b-vision-preview", // UPDATED: 11b-vision-preview was decommissioned
                temperature: 0,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errAlert = await response.text();
            throw new Error(`Groq API Error: ${response.status} - ${errAlert}`);
        }

        const json = await response.json();
        const content = json.choices[0]?.message?.content;

        if (!content) throw new Error("Groq no devolvió contenido.");

        const data = JSON.parse(content);
        console.log("✅ Groq Respondió:", data);

        return {
            invoiceNumber: data.invoiceNumber || "",
            price: data.price || 0, // Fallback, though we use items
            date: data.date || "",
            items: Array.isArray(data.items) ? data.items.map((item: any) => {
                // Normalize Brand
                let b = Brand.OTRO;
                const brandStr = (item.brand || "").toString().toUpperCase();
                if (Object.values(Brand).includes(brandStr as Brand)) {
                    b = brandStr as Brand;
                } else {
                    // Fuzzy match logic simplistic
                    if (brandStr.includes('SAM')) b = Brand.SAMSUNG;
                    else if (brandStr.includes('APP') || brandStr.includes('IPHONE')) b = Brand.APPLE;
                    else if (brandStr.includes('MOTO')) b = Brand.MOTOROLA;
                    // ... add other mappings if needed, or rely on AI being exact
                }
                return { brand: b, price: item.price };
            }) : [],
            customerName: data.customerName || ""
        };

    } catch (error: any) {
        console.error("❌ Error en Groq Service:", error);
        throw error;
    }
};
