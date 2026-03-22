export interface DeepSeekResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const queryDeepSeek = async (prompt: string, systemPrompt: string = "You are a helpful assistant.") => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_DEEPSEEK_API_KEY is not set. Please provide it in the environment variables.");
  }

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`DeepSeek API Error: ${error.message || response.statusText}`);
  }

  const data: DeepSeekResponse = await response.json();
  return data.choices[0].message.content;
};

export const searchSalvageWithDeepSeek = async (query: string) => {
  const systemPrompt = `You are a specialized salvage intelligence AI. 
  Your goal is to analyze search queries and provide specific locations or types of salvage opportunities in San Antonio, TX.
  Return a concise, professional intelligence report in Markdown.`;
  
  const prompt = `Analyze the following search query for salvage opportunities in San Antonio: "${query}". 
  Provide 2-3 specific recommendations or areas to check based on your knowledge of the city and salvage patterns.`;

  return queryDeepSeek(prompt, systemPrompt);
};
