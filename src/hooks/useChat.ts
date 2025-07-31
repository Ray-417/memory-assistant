import { useState } from 'react';
import axios from 'axios';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);

    const sendMessage = async (text: string) => {
        const newMessage: Message = { role: 'user', content: text };
        setMessages((prev) => [...prev, newMessage]);
        setLoading(true);

        try {
            const res = await axios.post('http://localhost:8000/api/chat', {
                messages: [...messages, newMessage],
            });
            console.log("API response:", res.data);
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
