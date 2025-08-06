import React, { useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { Input, Button, Flex, Space, Spin } from "antd";
import { Bubble } from "@ant-design/x";
import {
    UserOutlined,
    SyncOutlined,
    SmileOutlined,
    FrownOutlined,
} from "@ant-design/icons";
import type { GetProp, GetRef } from "antd";

interface BubbleItem {
    key: string | number;
    role: "user" | "ai";
    content?: string;
    footer?: React.ReactNode;
    loading?: boolean;
}


// 定义角色配置
const roles: GetProp<typeof Bubble.List, "roles"> = {
    ai: {
        placement: "start",
        avatar: { icon: <UserOutlined />, style: { background: "#fde3cf" } },
        style: {
            maxWidth: 600,
            marginInlineEnd: 44,
        },
        styles: {
            footer: {
                width: "100%",
            },
        },
        loadingRender: () => (
            <Space>
                <Spin size="small" />
                Assistant thinking...
            </Space>
        ),
    },
    user: {
        placement: "end",
        avatar: { icon: <UserOutlined />, style: { background: "#87d068" } },
    },
};

export default function ChatWindow() {
    const { messages, sendMessage, loading } = useChat();
    const [input, setInput] = useState("");
    const listRef = useRef<GetRef<typeof Bubble.List>>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            sendMessage(input);
            setInput("");
        }
    };

    // 渲染 footer 操作按钮（可选）
    const renderFooter = () => (
        <Flex>
            <Button size="small" type="text" icon={<SyncOutlined />} style={{ marginInlineEnd: "auto" }} />
            <Button size="small" type="text" icon={<SmileOutlined />} />
            <Button size="small" type="text" icon={<FrownOutlined />} />
        </Flex>
    );

    // 组装 bubble item 列表
    const items:BubbleItem[] = messages.map((m, index) => ({
        key: index,
        role: m.role === "user" ? "user" : "ai", // 把 "assistant" 映射为 "ai"
        content: m.content,
        ...(m.role === "assistant" ? { footer: renderFooter() } : {}),
    }));


    if (loading) {
        items.push({
            key: "loading",  // 使用字符串避免和 index 冲突
            role: "ai",
            loading: true,
            content: "",
        });
    }

    return (
        <Flex vertical style={{ height: "100%", padding: 16, borderLeft: "1px solid #f0f0f0" }}>
            <Bubble.List
                ref={listRef}
                style={{ flex: 1, overflowY: "auto", paddingInline: 16 }}
                roles={roles}
                items={items}
            />
            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
                <Flex gap="small">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        style={{ flex: 1 }}
                    />
                    <Button type="primary" htmlType="submit">
                        Send
                    </Button>
                </Flex>
            </form>
        </Flex>
    );
}
