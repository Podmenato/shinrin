export interface ModelProvider {
    chat: (prompt: string) => Promise<string>;
}