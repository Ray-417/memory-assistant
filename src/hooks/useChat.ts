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

    const sendMessage = async (text: string) => {
        const newMessage: Message = { role: 'user', content: text };
        setMessages((prev) => [...prev, newMessage]);
        setLoading(true);

        try {
            const res = await axios.post('http://localhost:8000/api/chat', {
                messages: [...messages, newMessage],
            });
            setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ 出错了，请稍后再试' }]);
        } finally {
            setLoading(false);
        }
    };

    return { messages, sendMessage, loading };
}
