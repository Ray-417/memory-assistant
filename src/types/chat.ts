export type Role = "user" | "assistant" | "system" | "tool";

export interface MessageItem {
    role: Role;
    content: string | Array<{ type?: string; text?: string; content?: string }>;
    // 按需扩展：id、name、tool_call_id...
}

export interface MessageScheme {
    message: string | MessageItem[];
    graph?: string;           // 默认 "common"
    thread_id?: string | null;
}

export type ChatHistory = [];
