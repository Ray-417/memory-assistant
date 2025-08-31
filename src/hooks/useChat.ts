import {useCallback, useRef, useState} from "react";

export type ChatMessage =
    | { id: string; type: "human"; content: string }
    | { id: string; type: "ai"; content: string }
    | { id: string; type: "file"; content: any }
    | { id: string; type: "tool_call"; content: string }
    | { id: string; type: "tool_result"; content: any }
    | { id: string; type: "custom_tool_result"; content: any }
    | { id: string; type: "custom_tool_call"; content: string }
    ;


function uuid() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

type SendOptions = {
    endpoint?: string;
    headers?: Record<string, string>;
    payloadBuilder?: (text: string) => any;
};

// —— 统一把 content 转成 string
function normalizeMessage(m: any): ChatMessage {
    let content: any = m.content;

    // 如果是数组（比如 list[MessageItem]）
    if (Array.isArray(content)) {
        // 取所有 text 拼起来
        content = content.map((c) => c.text ?? "").join("\n");
    }

    // 如果是对象，且有 text 字段
    else if (content && typeof content === "object") {
        if ("text" in content) {
            content = content.text;
        } else {
            // 兜底再 stringify
            content = JSON.stringify(content);
        }
    }

    return {...m, content};
}


export function useChat(opts: SendOptions = {}) {
    const endpoint = opts.endpoint ?? "/api/chat/tokens";
    const headers = opts.headers ?? {"Content-Type": "application/json"};
    const payloadBuilder =
        opts.payloadBuilder ?? ((text: string) => ({message: text}));

    const [messages, setMessagesRaw] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const setMessages = useCallback((raw: any[]) => {
        setMessagesRaw(raw);
    }, []);

    const appendHuman = useCallback((content: string) => {
        const m: ChatMessage = normalizeMessage({id: uuid(), type: "human", content});
        setMessagesRaw((prev) => [...prev, m]);
    }, []);

    const appendAiPlaceholder = useCallback(() => {
        const id = uuid();
        const m: ChatMessage = {id, type: "ai", content: ""};
        setMessagesRaw((prev) => [...prev, m]);
        return id;
    }, []);

    const appendAiTokenById = useCallback((id: string, token: string) => {
        setMessagesRaw((prev) => {
            const idx = prev.findIndex((x) => x.id === id);
            if (idx < 0) return prev;
            const next = [...prev];
            const old = next[idx] as Extract<ChatMessage, { type: "ai" }>;
            next[idx] = {...old, content: (old.content ?? "") + token};
            return next;
        });
    }, []);

    const sendMessage = useCallback(
        async (text: string) => {
            try {
                abortRef.current?.abort();
            } catch {
            }
            abortRef.current = new AbortController();

            appendHuman(text);
            const aiId = appendAiPlaceholder();
            setLoading(true);

            try {
                const resp = await fetch(endpoint, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payloadBuilder(text)),
                    signal: abortRef.current.signal,
                });

                if (!resp.ok || !resp.body) {
                    throw new Error(`HTTP ${resp.status}`);
                }

                const reader = resp.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buf = "";

                while (true) {
                    const {value, done} = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, {stream: true});

                    // SSE 情况
                    if (buf.includes("\n\n")) {
                        const events = buf.split("\n\n");
                        buf = events.pop()!;
                        for (const evt of events) {
                            for (const line of evt.split("\n")) {
                                if (!line.startsWith("data:")) continue;
                                const data = line.slice(5).trim();
                                if (!data) continue;
                                if (data === "[DONE]") break;
                                try {
                                    const parsed = JSON.parse(data);
                                    const token =
                                        typeof parsed === "string"
                                            ? parsed
                                            : parsed.token ?? parsed.delta ?? parsed.content ?? "";
                                    if (token) appendAiTokenById(aiId, token);
                                } catch {
                                    appendAiTokenById(aiId, data);
                                }
                            }
                        }
                    } else {
                        // 普通流
                        if (buf) {
                            appendAiTokenById(aiId, buf);
                            buf = "";
                        }
                    }
                }
            } catch (err) {
                appendAiTokenById(aiId, `\n\n> [Error] ${(err as Error)?.message ?? err}`);
            } finally {
                setLoading(false);
            }
        },
        [appendAiPlaceholder, appendAiTokenById, appendHuman, endpoint, headers, payloadBuilder]
    );

    return {messages, sendMessage, loading, setMessages};
}
