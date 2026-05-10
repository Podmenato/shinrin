import ky from "ky";

const OLLAMA_URL = "http://localhost:11434";
const MODEL = "llama3.2:3b";

interface OllamaResponse {
    message: {
        role: string;
        content: string;
    };
}

export const sendPrompt = async (prompt: string) => ky
    .post(`${OLLAMA_URL}/api/chat`, {
        json: {
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            stream: false,
        },
        timeout: false,
    })
    .json<OllamaResponse>();