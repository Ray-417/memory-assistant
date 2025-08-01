import { useChat } from "../hooks/useChat";
import { useState } from "react";

export default function ChatWindow() {
    const { messages, sendMessage, loading } = useChat();
    const [input, setInput] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            sendMessage(input);
            setInput("");
        }
    };

    return (
        <div className="flex flex-col h-full border-l p-4">
            <div className="flex-1 overflow-y-auto space-y-2">
                {messages.map((m, i) => (
                    <div key={i} className={`p-2 rounded ${m.role === "user" ? "bg-blue-100 self-end" : "bg-gray-200 self-start"}`}>
                        <p>{m.content}</p>
                    </div>
                ))}
                {loading && <p className="text-sm text-gray-500">Assistant 正在思考...</p>}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
                <input
                    className="flex-1 border rounded p-2"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入 prompt..."
                />
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                    发送
                </button>
            </form>
        </div>
    );
}
