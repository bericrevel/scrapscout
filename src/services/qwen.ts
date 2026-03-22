import { Opportunity } from "../types";

export interface QwenResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const queryQwen = async (prompt: string, systemPrompt: string = "You are a helpful assistant.", isJson: boolean = false) => {
  const apiKey = import.meta.env.VITE_QWEN_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_QWEN_API_KEY or VITE_OPENROUTER_API_KEY is not set. Please provide it in the environment variables.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://scrapscout.com", // Required by OpenRouter
      "X-Title": "ScrapScout", // Required by OpenRouter
    },
    body: JSON.stringify({
      model: "qwen/qwen-2.5-72b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: isJson ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Qwen API Error: ${error.error?.message || response.statusText}`);
  }

  const data: QwenResponse = await response.json();
  return data.choices[0].message.content;
};
