import { GoogleGenAI, Type } from "@google/genai";
import { Opportunity } from "../types";
import { queryQwen } from "./qwen";

let aiInstance: GoogleGenAI | null = null;

export const getGeminiClient = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

// Helper for file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/jpeg;base64, part
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

let cachedOpportunities: Opportunity[] | null = null;
let lastFetchTime = 0;
let lastFetchLocation: string | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "mock-1",
    title: "Alamo Heights Bulk Trash",
    description: "The affluent neighborhood of Alamo Heights is having its quarterly bulk trash pickup. Expect high-end furniture, electronics, and designer home decor. Residents often discard items that are in near-perfect condition simply to make room for new purchases. Scavenging here is highly productive but requires a discreet approach.",
    latitude: 29.4838,
    longitude: -98.4667,
    city: "San Antonio",
    county: "Bexar",
    category: "bulk_trash",
    legal_status: "green",
    start_date: new Date().toISOString().split('T')[0],
    items_expected: ["Mid-century modern furniture", "Flat screen TVs", "Garden equipment"],
    estimated_total_value: 4500,
    is_founder_exclusive: false
  },
  {
    id: "mock-2",
    title: "Stone Oak Estate Liquidation",
    description: "A massive estate sale in the gated communities of Stone Oak. The property contains a lifetime of collections, including vintage tools, high-end kitchen appliances, and potential antiques. The 2-hour early access for founders is critical here as the best items move fast. Security is present but professional.",
    latitude: 29.6434,
    longitude: -98.4547,
    city: "San Antonio",
    county: "Bexar",
    category: "estate_sale",
    legal_status: "yellow",
    start_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    items_expected: ["Power tools", "KitchenAid mixers", "Collectibles"],
    estimated_total_value: 12000,
    is_founder_exclusive: true
  }
];

export const fetchOpportunities = async (lat?: number, lng?: number, radius: number = 65): Promise<Opportunity[]> => {
  const now = Date.now();
  const currentLocationKey = lat && lng ? `${lat.toFixed(2)},${lng.toFixed(2)},${radius}` : `default,${radius}`;

  if (cachedOpportunities && (now - lastFetchTime < CACHE_DURATION) && lastFetchLocation === currentLocationKey) {
    return cachedOpportunities;
  }

  const ai = getGeminiClient();
  const locationContext = lat && lng 
    ? `coordinates ${lat}, ${lng} and surrounding areas within a ${radius} mile radius`
    : `San Antonio, Texas (and surrounding areas within a ${radius} mile radius)`;

  const prompt = `
    Search the web for real, upcoming salvage opportunities and free items in ${locationContext} for the month of ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.
    Find 8-12 specific, real events or listings happening right now or this month:
    1. Free stuff listed on websites like Facebook Marketplace, Craigslist, or Freecycle (e.g., "Curb alert", "Free furniture").
    2. Official city bulk trash pickup schedules or brush collection dates.
    3. Real estate sales happening this week/weekend (check estatesales.net or similar).
    4. Government auctions or university move-out dates.
    5. AI Intelligence predicted retail dumpster diving opportunities (e.g., post-holiday dumps, store closures, seasonal inventory rotations).
    
    For each event or listing, use live search data to estimate the current market resale value of the typical items found there.
    Make sure to provide realistic upcoming dates in YYYY-MM-DD format for 'start_date'.
    
    Provide a highly detailed description for each opportunity. Include specific items likely to be found, the condition they might be in, any historical context of the location, specific rules or guidelines for salvaging at this event, and tips for maximizing the value found there. The description should be at least 3-4 sentences long.
    
    Return a JSON array of objects matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING, description: "Real name of the event or location" },
              description: { type: Type.STRING, description: "Highly detailed description about the event, specific items that can be found, rules, and tips for salvaging. Must be at least 3-4 sentences." },
              latitude: { type: Type.NUMBER, description: "Approximate latitude" },
              longitude: { type: Type.NUMBER, description: "Approximate longitude" },
              city: { type: Type.STRING },
              county: { type: Type.STRING },
              category: { type: Type.STRING, description: "e.g., bulk_trash, estate_sale, auction" },
              legal_status: { type: Type.STRING, description: "green, yellow, or red" },
              start_date: { type: Type.STRING },
              items_expected: { type: Type.ARRAY, items: { type: Type.STRING } },
              estimated_total_value: { type: Type.NUMBER, description: "Live estimated value in USD based on current market prices" },
              is_founder_exclusive: { type: Type.BOOLEAN, description: "Set to true for high-value items to simulate the 2-hour early access for founders" }
            },
            required: ["id", "title", "description", "latitude", "longitude", "city", "county", "category", "legal_status", "items_expected", "estimated_total_value", "is_founder_exclusive"]
          }
        }
      }
    });

    let text = response.text || "[]";
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    cachedOpportunities = data;
    lastFetchTime = now;
    lastFetchLocation = currentLocationKey;
    return data;
  } catch (error: any) {
    const errorMsg = (error?.message || "").toLowerCase();
    const isQuotaError = 
      errorMsg.includes("429") || 
      errorMsg.includes("quota") || 
      errorMsg.includes("resource_exhausted") ||
      error?.status === "RESOURCE_EXHAUSTED" ||
      error?.code === 429;

    if (isQuotaError) {
      console.warn("Gemini API Quota Exceeded. Falling back to Qwen.");
      try {
        const qwenResponse = await queryQwen(prompt, "You are a specialized salvage intelligence AI. Return a JSON array of objects matching the requested schema.", true);
        let text = qwenResponse || "[]";
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const data = JSON.parse(text);
        cachedOpportunities = data;
        lastFetchTime = now;
        lastFetchLocation = currentLocationKey;
        return data;
      } catch (qwenError: any) {
        console.warn("Qwen fallback unavailable (API key missing or error). Using mock data.");
        return MOCK_OPPORTUNITIES;
      }
    }
    console.error("Error fetching opportunities:", error);
    throw new Error(`TRANSMISSION ERROR: ${error?.message || "Unknown error occurred."}`);
  }
};

export const fetchLaws = async (): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `Search the web for the most up-to-date laws regarding dumpster diving, curbside trash pickup, and salvaging in San Antonio, Texas. Summarize the legality, any specific ordinances (like commercial vs residential), and general advice for staying legal. Format as a short, readable markdown string.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "";
  } catch (error: any) {
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
      console.warn("Gemini API Quota Exceeded. Falling back to Qwen.");
      try {
        const qwenResponse = await queryQwen(prompt, "You are a legal assistant summarizing salvage laws.");
        return qwenResponse || "### Legal Status: San Antonio, TX\n\n**Dumpster Diving:** Generally legal in public areas if the dumpster is on the curb. Commercial dumpsters are often private property; trespassing laws apply. \n\n**Curbside Pickup:** Once items are placed on the curb for bulk pickup, they are often considered abandoned property, but city ordinances may vary. \n\n**Advice:** Always be respectful, don't make a mess, and if asked to leave, do so immediately.";
      } catch (qwenError) {
        return "### Legal Status: San Antonio, TX\n\n**Dumpster Diving:** Generally legal in public areas if the dumpster is on the curb. Commercial dumpsters are often private property; trespassing laws apply. \n\n**Curbside Pickup:** Once items are placed on the curb for bulk pickup, they are often considered abandoned property, but city ordinances may vary. \n\n**Advice:** Always be respectful, don't make a mess, and if asked to leave, do so immediately.";
      }
    }
    console.error("Error fetching laws:", error);
    return `TRANSMISSION ERROR: ${error?.message || "Unknown error occurred."}`;
  }
};

export const fetchTemplates = async (): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `Write a professional, polite, and short template script (both email and in-person) for asking a retail store manager or construction site manager for permission to salvage items from their dumpsters. Format as markdown.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });
    return response.text || "";
  } catch (error: any) {
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
      console.warn("Gemini API Quota Exceeded. Falling back to Qwen.");
      try {
        const qwenResponse = await queryQwen(prompt, "You are a professional assistant writing polite permission scripts.");
        return qwenResponse || "NEXUS CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.";
      } catch (qwenError) {
        return "NEXUS CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.";
      }
    }
    console.error("Error fetching templates:", error);
    return `TRANSMISSION ERROR: ${error?.message || "Unknown error occurred."}`;
  }
};

export const findBuyers = async (itemName: string, material: string): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `Search the web for scrap yards, recycling centers, or specialized buyers in San Antonio, Texas that would buy "${itemName}" made of "${material}". List 2-3 real businesses with their approximate location or name, and give a brief tip on how to sell this specific item. Format as markdown.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "";
  } catch (error: any) {
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
      console.warn("Gemini API Quota Exceeded. Falling back to Qwen.");
      try {
        const qwenResponse = await queryQwen(prompt, "You are a local market expert finding buyers for salvage items.");
        return qwenResponse || "NEXUS CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.";
      } catch (qwenError) {
        return "NEXUS CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.";
      }
    }
    console.error("Error finding buyers:", error);
    return `TRANSMISSION ERROR: ${error?.message || "Unknown error occurred."}`;
  }
};

export const generateListing = async (itemDetails: any): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `You are an expert online seller and appraiser. Create a highly optimized, catchy, and SEO-friendly listing for Facebook Marketplace, Craigslist, or eBay for the following item:
  
  Item Name: ${itemDetails.item_name}
  Material: ${itemDetails.material}
  Condition: ${itemDetails.condition}
  Repair Needs: ${itemDetails.repair_needs || 'None'}
  Extracted Text/Serial: ${itemDetails.extracted_text || 'None'}
  Estimated Resale Value: $${itemDetails.resale_value}
  
  Include:
  1. A catchy, keyword-rich Title
  2. A compelling Description (highlighting its potential, condition, specific use cases, and why it's a great deal. Be honest about any repair needs but frame them as an easy fix or a great DIY project).
  3. Suggested Pricing Strategy (e.g., "List at $X, accept $Y")
  4. Suggested Tags (comma separated)
  
  Output the listing as clean, readable Markdown. Make it sound professional yet approachable.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "";
  } catch (error: any) {
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
      console.warn("Gemini API Quota Exceeded. Falling back to Qwen.");
      try {
        const qwenResponse = await queryQwen(prompt, "You are an expert online seller creating catchy listings.");
        return qwenResponse || "SCRAPSCOUT CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.";
      } catch (qwenError) {
        return "SCRAPSCOUT CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.";
      }
    }
    console.error("Error generating listing:", error);
    return `TRANSMISSION ERROR: ${error?.message || "Unknown error occurred."}`;
  }
};

export interface MarketData {
  metal: string;
  current_price: string;
  trend: 'up' | 'down' | 'flat';
  recommendation: 'Hold' | 'Sell';
  reasoning: string;
}

export const fetchMarketData = async (): Promise<MarketData[]> => {
  const ai = getGeminiClient();
  const prompt = `
    Search the web for today's live scrap metal prices in the US (specifically Bare Bright Copper, #1 Copper, Extruded Aluminum, and Yellow Brass).
    Analyze recent market news and provide a "Hold or Sell" recommendation for each metal type.
    Return ONLY a valid JSON array of objects with the following exact keys:
    [
      {
        "metal": "string (e.g., Bare Bright Copper)",
        "current_price": "string (e.g., $3.85/lb)",
        "trend": "string (must be exactly 'up', 'down', or 'flat')",
        "recommendation": "string (must be exactly 'Hold' or 'Sell')",
        "reasoning": "string (1-2 sentences explaining why based on current market news)"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              metal: { type: Type.STRING },
              current_price: { type: Type.STRING },
              trend: { type: Type.STRING },
              recommendation: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ["metal", "current_price", "trend", "recommendation", "reasoning"]
          }
        }
      }
    });

    let text = response.text || "[]";
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error fetching market data:", error);
    return [
      { metal: "Bare Bright Copper", current_price: "$3.85/lb", trend: "up", recommendation: "Sell", reasoning: "Market is currently peaking due to supply constraints." },
      { metal: "#1 Copper", current_price: "$3.65/lb", trend: "flat", recommendation: "Hold", reasoning: "Prices are stable but expected to rise next quarter." },
      { metal: "Extruded Aluminum", current_price: "$0.65/lb", trend: "down", recommendation: "Hold", reasoning: "Oversupply in the market has temporarily depressed prices." },
      { metal: "Yellow Brass", current_price: "$2.15/lb", trend: "up", recommendation: "Sell", reasoning: "Strong industrial demand is driving prices up." }
    ];
  }
};

export const generateRoutePlan = async (opportunities: Opportunity[], lat?: number, lng?: number): Promise<{ route: Opportunity[], rationale: string }> => {
  const ai = getGeminiClient();
  const prompt = `
    You are an expert logistics AI for a salvage operation.
    Given the following salvage opportunities and the user's current location (Lat: ${lat || 'Unknown'}, Lng: ${lng || 'Unknown'}), generate the most efficient "First Strike" route.
    Prioritize high value items and early start times.
    
    Opportunities:
    ${JSON.stringify(opportunities.map(o => ({ id: o.id, title: o.title, value: o.estimated_total_value, start: o.start_date, lat: o.latitude, lng: o.longitude })), null, 2)}
    
    Return a JSON object with:
    1. "ordered_ids": an array of the opportunity IDs in the optimal order to visit.
    2. "rationale": a 2-3 sentence explanation of why this route is optimal (e.g., "Starting at the high-value estate sale first ensures you beat the crowd, then looping south catches the bulk trash before noon...").
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ordered_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
            rationale: { type: Type.STRING }
          },
          required: ["ordered_ids", "rationale"]
        }
      }
    });

    let text = response.text || "{}";
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    
    const orderedOpps = data.ordered_ids.map((id: string) => opportunities.find(o => o.id === id)).filter(Boolean);
    return { route: orderedOpps, rationale: data.rationale };
  } catch (error) {
    console.error("Error generating route:", error);
    return { route: opportunities, rationale: "AI routing offline. Displaying default sequence." };
  }
};

export const generateNegotiationScript = async (item: any, askingPrice: string): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `
    You are an expert negotiator for salvage and scrap items.
    The user is trying to buy a salvaged item:
    Item Name: ${item.item_name}
    Material: ${item.material}
    Condition: ${item.condition}
    Estimated Resale Value: $${item.resale_value}
    Estimated Scrap Value: $${item.scrap_value}
    
    The seller is currently asking for: $${askingPrice}.
    
    Provide a short, psychological negotiation script (what the user should literally say to the seller) to talk them down to a profitable price. 
    Calculate the optimal counter-offer based on the scrap/resale value.
    Keep it conversational, polite, but firm. Mention the condition or repair costs as leverage.
    Output as clean Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Could not generate script.";
  } catch (error) {
    console.error("Error generating script:", error);
    return "SCRAPSCOUT CORE OFFLINE: Negotiation module unavailable.";
  }
};

export const generateRestorationGuide = async (item: any): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `
    You are an expert master restorer and DIY specialist.
    Create a comprehensive, step-by-step restoration guide for the following salvaged item:
    
    Item Name: ${item.item_name}
    Material: ${item.material}
    Condition: ${item.condition}
    Repair Needs: ${item.repair_needs || 'General restoration'}
    
    Include:
    1. A list of required tools and materials.
    2. Safety precautions.
    3. Detailed, numbered steps for the restoration process.
    4. Pro tips for increasing the final resale value.
    5. A "Master's Secret" tip for this specific type of item.
    
    Format the output as clean, professional Markdown with clear headings.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Could not generate restoration guide.";
  } catch (error) {
    console.error("Error generating restoration guide:", error);
    return "SCRAPSCOUT CORE OFFLINE: Restoration module unavailable.";
  }
};

export const findNearbyScrapYards = async (lat: number, lng: number, itemMaterial?: string): Promise<any[]> => {
  const ai = getGeminiClient();
  const prompt = `
    Find the nearest recycling centers, scrap yards, or metal buyers near coordinates ${lat}, ${lng}.
    ${itemMaterial ? `Specifically look for yards that offer the best rates for ${itemMaterial}.` : 'Look for yards with high payouts for copper, aluminum, and brass.'}
    
    For each location, provide:
    1. Name
    2. Address
    3. Rating and total reviews
    4. Latitude and Longitude
    5. A "Payout Estimate" (e.g., "High for Copper", "Best for Steel", "Standard Rates") based on recent market data or reviews.
    6. A "Pro Tip" for selling at this specific location.
    
    Return a JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        }
      }
    });

    // Extract grounding chunks for URLs and place info
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const chunks = groundingMetadata?.groundingChunks;
    const text = response.text || "[]";
    
    try {
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      // Enrich with grounding URLs if available
      if (chunks && Array.isArray(parsed)) {
        return parsed.map((item, index) => {
          const chunk = chunks[index];
          return {
            ...item,
            maps_url: chunk?.maps?.uri || null,
            source: chunk?.maps?.title || null
          };
        });
      }
      return parsed;
    } catch (e) {
      console.warn("Failed to parse scrap yard JSON, extracting from grounding metadata");
      if (chunks) {
        return chunks.map((chunk: any) => ({
          name: chunk.maps?.title || "Unknown Yard",
          address: "Check Maps for Address",
          latitude: lat + (Math.random() - 0.5) * 0.05,
          longitude: lng + (Math.random() - 0.5) * 0.05,
          maps_url: chunk.maps?.uri || "",
          payout_estimate: "Market Rates",
          pro_tip: "Call ahead to verify current pricing."
        }));
      }
      return [];
    }
  } catch (error) {
    console.error("Error finding scrap yards:", error);
    return [];
  }
};

export const generateScoutReport = async (lat: number, lng: number): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `
    You are the Scout-AI Strategic Intelligence Unit. 
    Analyze the current salvage landscape near coordinates ${lat}, ${lng} based on recent web data, market trends, and city schedules.
    
    Provide a "Tactical Salvage Report" including:
    1. **High-Value Sector**: Which neighborhood or area currently has the highest probability of premium scrap?
    2. **Material of the Day**: Based on market spikes, what should the user prioritize today?
    3. **Intelligence Leak**: Mention a specific upcoming event or "secret" spot (e.g., a store closing, a specific bulk trash route).
    4. **Risk Assessment**: Any legal or safety warnings for the current sector.
    
    Format as a highly professional, futuristic Markdown report. Use bold headings and bullet points.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "Intelligence feed interrupted. Signal lost.";
  } catch (error) {
    console.error("Error generating scout report:", error);
    return "SCRAPSCOUT CORE OFFLINE: Strategic intelligence unavailable.";
  }
};
