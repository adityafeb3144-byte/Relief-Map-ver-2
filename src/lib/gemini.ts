import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeEmergency(message: string, base64Image?: string) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "") {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your environment variables.");
  }

  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this emergency request. 
  1. Categorize it into one of: Food, Medical, Rescue, Other. 
  2. Assign an urgency score from 1 to 10 (10 being most critical).
  3. Suggest 3-5 specific tools, items, or equipment a responder should bring to help (e.g., "First aid kit", "Bottled water", "Heavy duty rope").
  
  Request: "${message}"`;

  const parts: any[] = [{ text: prompt }];
  if (base64Image) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: ["Food", "Medical", "Rescue", "Other"],
            },
            urgency: {
              type: Type.NUMBER,
              description: "Score from 1 to 10",
            },
            recommendedTools: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 3-5 recommended items for responders",
            },
          },
          required: ["category", "urgency", "recommendedTools"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API key not valid")) {
      throw new Error("Invalid Gemini API key. Please check your Vercel settings.");
    }
    throw error;
  }
}
