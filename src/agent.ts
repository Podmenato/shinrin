import {sendPrompt} from "./api";

export async function runAgent(prompt: string): Promise<string> {
  const response = await sendPrompt(prompt);

  return response.message.content;
}
