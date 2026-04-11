import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "" });

export async function analyzeEmergency(message: string, base64Image?: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this emergency request. Categorize it into one of: Food, Medical, Rescue, Other. Assign an urgency score from 1 to 10 (10 being most critical).
  
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
        },
        required: ["category", "urgency"],
      },
    },
  });

  return JSON.parse(response.text);
}
