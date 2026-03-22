
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function search() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "What is the 'Web2wave paywall package'? Is it an npm package or a specific design pattern?",
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  console.log(response.text);
}

search();
