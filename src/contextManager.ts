export type Message = {
    role: "user" | "assistant" | "system";
    content: string;
};

export class ContextManager {
    private history: Message[] = [];

    constructor(private systemPrompt: string) {}

    add(message: Message): void {
        this.history.push(message);
    }

    build(): Message[] {
        return [{ role: "system", content: this.systemPrompt }, ...this.history];
    }

    clear(): void {
        this.history = [];
    }
}
