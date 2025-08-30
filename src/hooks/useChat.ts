import { useState, useEffect } from 'react';
import axios from 'axios';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);

    // ✅ 加载历史消息
    const fetchMessages = async () => {
        try {
            const res = await axios.get('http://localhost:8000/api/chat/history');
            if (Array.isArray(res.data)) {
                setMessages(res.data);
            } else {
                console.error("历史记录格式错误", res.data);
            }
        } catch (error) {
            console.error("加载历史记录失败", error);
        }
    };

    // ✅ 页面加载时自动调用
    useEffect(() => {
        fetchMessages();
    }, []);

    // ✅ 发送消息 + SSE 流式接收
    const sendMessage = async (text: string) => {
        const newMessage: Message = { role: 'user', content: text };
        setMessages((prev) => [...prev, newMessage]);
        setLoading(true);

        try {
            const eventSource = new EventSource(
                `http://localhost:8000/api/chat/stream?message=${encodeURIComponent(text)}`
            );

            let aiReply = "";
            let firstToken = true; // 标记是否是第一次接收

            eventSource.onmessage = (event) => {
                if (event.data === "[DONE]") {
                    eventSource.close();
                    // 确保最后结束时 loading 也为 false（容错）
                    setLoading(false);
                    return;
                }

                aiReply += event.data;

                // 🔑 第一次收到 token，立刻关闭 loading
                if (firstToken) {
                    setLoading(false);
                    firstToken = false;
                }

                setMessages((prev) => {
                    if (prev.length > 0 && prev[prev.length - 1].role === "assistant") {
                        return [
                            ...prev.slice(0, -1),
                            { role: "assistant", content: aiReply }
                        ];
                    } else {
                        return [...prev, { role: "assistant", content: aiReply }];
                    }
                });
            };

            eventSource.onerror = (err) => {
                console.error("SSE error:", err);
                setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ 出错了，请稍后再试" }]);
                eventSource.close();
                setLoading(false);
            };

        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ 出错了，请稍后再试" }]);
            setLoading(false);
        }
    };

    return { messages, sendMessage, loading };
}
