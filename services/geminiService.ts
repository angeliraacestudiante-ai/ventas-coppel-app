```typescript
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";

// --- CONFIGURACIÓN ---
const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
].filter(Boolean) as string[];

const parseSpanishDate = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return undefined;
  // Intento 1: Ya está en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Intento 2: Formato DD-MMM-YY o DD-MMM-YYYY (común en tickets)
  // Mapeo de meses español a número
  const monthMap: { [key: string]: string } = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
    'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };

  try {
    // Buscar patrones: 02-Jun-25, 02/Jun/25, 02 Jun 2025
    const parts = dateStr.match(/(\d{1,2})[-/ ]([a-zA-Z]{3,})[-/ ](\d{2,4})/);
    if (parts) {
      const day = parts[1].padStart(2, '0');
      const monthStr = parts[2].toLowerCase().substring(0, 3);
      const yearRaw = parts[3];
      const year = yearRaw.length === 2 ? `20${ yearRaw } ` : yearRaw;
      
      const month = monthMap[monthStr];
      if (month) {
        return `${ year } -${ month } -${ day } `;
      }
    }
  } catch (e) {
    console.warn("Error parsing date:", dateStr, e);
  }
  return undefined; // Fallback
};

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult | null> => {
  const apiKeys = API_KEYS;
  
  if (apiKeys.length === 0) {
    console.error("❌ No se encontraron claves API de Gemini.");
    throw new Error("Faltan las API Keys de Gemini.");
  }

  // Configuramos modelos: Solo versiones estables y potentes
  const candidateModels = [
    "gemini-1.5-flash-latest", // Rápido y barato
    "gemini-1.5-pro-latest",   // Más potente si el flash falla
  ];

  const base64Data = base64Image.split(',')[1] || base64Image;

  // ESTRATEGIA: "EXTRACCIÓN CRUDA"
  const prompt = `Analiza este ticket de Coppel.Extrae los DATOS CRUDOS(Raw Data) tal como aparecen en el papel.

  1. invoiceNumber: El texto que sigue a "Factura No.", "Folio" o "Ticket". (Ej: "1053 753779" o "1053-753779").
  2. rawDate: Busca la palabra "Fecha:" y extrae todo el texto que esté A SU LADO. (Ej: "01-Jun-25").
  3. rawCustomerName: Busca la línea que contiene "Nombre:" y devuelve LA LÍNEA COMPLETA. (Ej: "Nombre: ALEJANDRA DE LA CRUZ FAJARDO").
  
  4. items: Lista de celulares detectados.
     - brand: MARCA(SAMSUNG, APPLE, MOTOROLA, ETC).
     - price: PRECIO FINAL(Base - Descuentos).
     - Importante: Ignora items de precio <= 1.00(chips).
     - Devuelve un array de objetos { brand, price }.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg",
    },
  };

  // Intentar con rotación de claves y modelos
  for (const [keyIndex, currentApiKey] of apiKeys.entries()) {
    const genAI = new GoogleGenerativeAI(currentApiKey);
    
    for (const modelName of candidateModels) {
      // 2 Intentos por modelo
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`🤖 IA: Usando Key #${ keyIndex + 1 } | Modelo: ${ modelName } | Intento: ${ attempt + 1 } `);
          
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                  invoiceNumber: { type: SchemaType.STRING },
                  rawDate: { type: SchemaType.STRING },
                  rawCustomerName: { type: SchemaType.STRING },
                  items: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        brand: { type: SchemaType.STRING },
                        price: { type: SchemaType.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          });

          const result = await model.generateContent([prompt, imagePart]);
          const response = await result.response;
          let text = response.text();

          if (text) {
            // LIMPIEZA JSON: Encontrar el primer '{' y el último '}'
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              text = text.substring(firstBrace, lastBrace + 1);
            }

            const data = JSON.parse(text);
            console.log(`✅ ÉXITO IA: `, data);

            // A) Fecha
            let finalDate = undefined;
            if (data.rawDate) {
               const complexDateMatch = data.rawDate.match(/(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})/);
               if (complexDateMatch) {
                 finalDate = parseSpanishDate(complexDateMatch[0]); 
               } else {
                 const simpleDateMatch = data.rawDate.match(/(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{2,4})/);
                 if (simpleDateMatch) {
                   let [_, d, m, y] = simpleDateMatch;
                   if (y.length === 2) y = '20' + y;
                   finalDate = `${ y } -${ m.padStart(2, '0') } -${ d.padStart(2, '0') } `;
                 }
               }
            }

            // B) Nombre
            let finalName = '';
            if (data.rawCustomerName) {
              finalName = data.rawCustomerName
                .replace(/[\r\n]+/g, ' ')
                .replace(/^.*nombre\s*[:.]?\s*/i, '') 
                .replace(/\s*No\.\s*de\s*Cliente.*$/i, '') 
                .trim();
            }

            return {
              invoiceNumber: data.invoiceNumber,
              price: 0, 
              date: finalDate, 
              items: data.items?.map((item: any) => {
                let b = Brand.OTRO;
                const normalizedBrand = item.brand ? item.brand.toString().toUpperCase().trim() : '';
                if (Object.values(Brand).includes(normalizedBrand as Brand)) {
                  b = normalizedBrand as Brand;
                }
                return { brand: b, price: item.price };
              }),
              customerName: finalName
            };
          }
        } catch (error: any) {
            }
          }

          console.warn(`  ⚠️ Falló ${ modelName } con Key #${ keyIndex + 1 }: `, error.message);
          lastError = error;

          // Si es API Key inválida
          if (msg.includes("API key")) {
            attemptLogs.push(`Key #${ keyIndex + 1 }: ❌ Key Inválida`);
            keyFailed = true;
            break; // Salir del bucle de intentos y cambiar llave
          }

          // Otros errores (ej. modelo no encontrado o error interno de Google)
          // No hacemos retries, probamos el siguiente modelo
          if (modelName === candidateModels[candidateModels.length - 1] && attempt === MAX_RETRIES - 1) {
            attemptLogs.push(`Key #${ keyIndex + 1 }: ⚠️ Error técnico(${ msg.slice(0, 20) }...)`);
          }

          // Si es un error distinto a 429, salimos del retry loop y dejamos que el loop de modelos continúe
          break;
        }
      }
    }
  }

  // --- FALLBACK: INTENTAR CON GROQ (Llama 3.2 Vision) --
  console.warn("⚠️ Todos los intentos de Gemini fallaron. Activando protocolo de respaldo (GROQ)...");

  try {
    const groqResult = await analyzeTicketWithGroq(base64Image);
    if (groqResult) {
      console.log("🏆 RESCATADO POR GROQ!");
      return groqResult;
    }
  } catch (groqError: any) {
    console.error("❌ Falló también el respaldo de Groq:", groqError.message);
    attemptLogs.push(`GROQ Backup: ❌ Error(${ groqError.message })`);
  }

  // Si llegamos aquí, fallaron todas (Gemini + Groq)
  console.error("❌ Muerte total del sistema de IA.", lastError);

  // Mostrar reporte detallado al usuario
  throw new Error(`FALLO TOTAL(Gemini + Groq): \n\nPosible causa: Faltan las llaves API(API KEYS) en la configuración del servidor.\n\nSi la app está en línea, revisa las "Environment Variables" en Vercel / Netlify.\n\nDetalles técnicos: \n${ attemptLogs.join('\n') } `);
};

