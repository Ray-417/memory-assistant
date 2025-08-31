// src/components/ChatWindow.tsx
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Bubble, Sender, Attachments, ThoughtChain} from "@ant-design/x";
import {Button, Flex, Space, Spin, message as antdMessage} from "antd";
import {
    UserOutlined,
    SyncOutlined,
    SmileOutlined,
    FrownOutlined,
    CopyOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
} from "@ant-design/icons";
import type {GetProp, GetRef} from "antd";
import markdownit from "markdown-it";
import type {BubbleProps} from "@ant-design/x";
import type {ThoughtChainProps} from "@ant-design/x";

/* ============ 常量 ============ */
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const THREAD_ID = "1";
const GRAPH_NAME = "common";

/* ============ Markdown 渲染 ============ */
const md = markdownit({html: true, breaks: true, linkify: true});
const MarkdownView: React.FC<{ content: string }> = ({content}) => {
    const html = md.render(String(content ?? ""));
    return (
        <div
            className="markdown-body"
            dangerouslySetInnerHTML={{__html: html}}
        />
    );
};

/* ============ 小工具 ============ */
const pretty = (v: unknown) =>
    typeof v === "string" ? v : JSON.stringify(v ?? "", null, 2);

/* ---- human 分片拍扁 -> markdown ---- */
function contentToMarkdown(content: any): string {
    if (content == null) return "";
    if (typeof content === "string") return content;

    if (typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
    }

    if (Array.isArray(content)) {
        return content.map(partToMarkdown).join("");
    }

    try {
        return "```json\n" + JSON.stringify(content, null, 2) + "\n```";
    } catch {
        return String(content);
    }
}

function partToMarkdown(part: any): string {
    if (!part || typeof part !== "object") return String(part ?? "");
    const t = part.type ?? part.kind ?? "";
    switch (t) {
        case "text":
            return String(part.text ?? "");
        case "image_url":
        case "image": {
            const url = part.url ?? part.image_url?.url ?? part.image_url ?? "";
            const alt = part.alt ?? "image";
            return url ? `![${alt}](${url})\n` : "";
        }
        case "file":
        case "attachment": {
            if (part.url) return `[${part.name ?? "file"}](${part.url})\n`;
            return "```json\n" + JSON.stringify(part, null, 2) + "\n```\n";
        }
        default:
            return "```json\n" + JSON.stringify(part, null, 2) + "\n```\n";
    }
}

/* ---- 从历史 ai 消息提取 tool_calls ---- */
const extractToolCalls = (msg: any) => {
    const calls = msg.tool_calls ?? msg.additional_kwargs?.tool_calls ?? [];
    return (calls || []).map((c: any) => {
        const name = c.function?.name ?? c.name ?? "Tool call";
        const id = c.id ?? c.tool_call_id ?? c.call_id ?? undefined;
        let args: any = c.function?.arguments ?? c.args ?? c.input ?? c.parameters ?? {};
        if (typeof args === "string") {
            try {
                args = JSON.parse(args);
            } catch {
                // 非 JSON，原样展示
            }
        }
        return {id, name, args};
    });
};

/* ---- 从历史 tool 消息提取 result ---- */
const extractToolResult = (msg: any) => {
    const id = msg.tool_call_id ?? msg.tool_call?.id ?? msg.id;
    const name = msg.name ?? msg.tool_name ?? undefined;
    const status = msg.status ?? "success";
    const output =
        msg.output ??
        msg.result ??
        msg.data ??
        msg.content ?? // 一些服务商把字符串放 content
        null;
    return {id, name, status, output};
};

/* ============ UI 类型 & 角色 ============ */
type RoleKey = "user" | "ai";

interface BubbleItem {
    key: string | number;
    role: RoleKey;
    loading?: boolean;
    messageRender?: BubbleProps["messageRender"];
    footer?: () => React.ReactNode;
    content?: any;
}

const roles: GetProp<typeof Bubble.List, "roles"> = {
    user: {
        placement: "end",
        avatar: {icon: <UserOutlined/>, style: {background: "#87d068"}},
    },
    ai: {
        placement: "start",
        avatar: {icon: <UserOutlined/>, style: {background: "#fde3cf"}},
        style: {maxWidth: 720, marginInlineEnd: 44},
        styles: {footer: {width: "100%"}},
        loadingRender: () => (
            <Space>
                <Spin size="small"/> loading...
            </Space>
        ),
    },
};

/* ============ 组件 ============ */
export default function ChatWindow() {
    const listRef = useRef<GetRef<typeof Bubble.List>>(null);

    // 显示用的“气泡列表”
    const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
    // 输入框
    const [input, setInput] = useState("");
    // 发送按钮 loading
    const [sending, setSending] = useState(false);
    // 历史加载 loading
    const [loadingHistory, setLoadingHistory] = useState(true);

    // 关键：全局 key 计数器
    const keyCounterRef = useRef(0);
    const nextKey = () => `k-${keyCounterRef.current++}`;

    // 缓存：ai 流式内容（key -> 拼接文本）
    const aiContentMap = useRef<Record<string | number, string>>({});
    // 缓存：工具链卡片（tool_call_id -> { bubbleKey, items }）
    const toolChainMap = useRef<
        Record<string, { bubbleKey: React.Key; items: NonNullable<ThoughtChainProps["items"]> }>
    >({});

    /* ---------------- 历史加载（只做一次） ---------------- */
    useEffect(() => {
        (async () => {
            setLoadingHistory(true);
            try {
                const resp = await fetch(`${API_BASE}/chat/json?thread_id=${THREAD_ID}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const history = await resp.json();

                // 顺序渲染历史：遇到 ai 的 tool_calls 先画“pending”工具卡片；遇到 tool 结果则补齐
                const newBubbles: BubbleItem[] = [];
                toolChainMap.current = {}; // 历史阶段也用同一个 map，后面 SSE 阶段继续复用

                for (const msg of history) {
                    // 1) ai：可能内含 tool_calls
                    if (msg.type === "ai") {
                        const toolCalls = extractToolCalls(msg);
                        for (const c of toolCalls) {
                            // 每个 tool_call 独立一张 ThoughtChain 卡片
                            const toolId = c.id ?? `hist-${Date.now()}-${Math.random()}`;
                            const items = [
                                {
                                    title: `调用工具：${c.name}`,
                                    status: "pending",
                                    icon: <LoadingOutlined/>,
                                    description:
                                        !c.args || (typeof c.args === "object" && Object.keys(c.args).length === 0)
                                            ? "无参数传入"
                                            : `参数：\n${pretty(c.args)}`,
                                },
                            ];
                            const bubbleKey = nextKey();
                            toolChainMap.current[toolId] = {bubbleKey, items};
                            newBubbles.push({
                                key: bubbleKey,
                                role: "ai",
                                messageRender: () => <ThoughtChain items={items}/>,
                            });
                        }
                        // ai 正文
                        if (msg.content && String(msg.content).trim() !== "") {
                            newBubbles.push({
                                key: nextKey(),
                                role: "ai",
                                messageRender: () => <MarkdownView content={String(msg.content)}/>,
                                footer: () => (
                                    <Flex>
                                        <Button
                                            size="small"
                                            type="text"
                                            icon={<CopyOutlined/>}
                                            onClick={() => {
                                                navigator.clipboard.writeText(String(msg.content || ""));
                                                antdMessage.success("已复制");
                                            }}
                                        />
                                    </Flex>
                                ),
                            });
                        }
                        continue;
                    }

                    // 2) 工具结果
                    if (msg.type === "tool") {
                        const r = extractToolResult(msg);
                        const toolId = r.id ?? `hist-${Date.now()}-${Math.random()}`;
                        let chain = toolChainMap.current[toolId];

                        if (!chain) {
                            // 历史里先出现结果，再出现调用（或调用缺失）—补一个卡片再更新
                            const bubbleKey = nextKey();
                            chain = {bubbleKey, items: []};
                            toolChainMap.current[toolId] = chain;
                            newBubbles.push({
                                key: bubbleKey,
                                role: "ai",
                                messageRender: () => <ThoughtChain items={chain!.items}/>,
                            });
                        }
                        if (chain.items.length === 0) {
                            chain.items.push({
                                title: r.name ? `调用工具：${r.name}` : "工具调用",
                                status: "pending",
                                icon: <LoadingOutlined/>,
                                description: "等待结果…",
                            });
                        }
                        const lastIdx = chain.items.length - 1;
                        const ok = String(r.status ?? "success").toLowerCase() === "success";
                        chain.items[lastIdx] = {
                            ...(chain.items[lastIdx] || {title: r.name ? `调用工具：${r.name}` : "工具调用"}),
                            status: ok ? "success" : "error",
                            icon: ok ? <CheckCircleOutlined/> : <FrownOutlined/>,
                            description: typeof r.output === "string" ? r.output : pretty(r.output),
                        };
                        continue;
                    }

                    // 3) human
                    if (msg.type === "human" || msg.role === "user") {
                        if (Array.isArray(msg.content)) {
                            for (const sub of msg.content) {
                                if (sub.type === "text" && sub.filename) {
                                    // 用“用户气泡 + 文件卡片”的形式
                                    const file = {
                                        uid: sub.filename,
                                        name: sub.filename,
                                        description: "点击查看文件内容",
                                        text: sub.text,
                                    };
                                    newBubbles.push({
                                        key: nextKey(),
                                        role: "user",
                                        messageRender: () => (
                                            <Attachments.FileCard
                                                item={file}
                                                onClick={() => antdMessage.info(`文件预览: ${file.name}`)}
                                            />
                                        ),
                                    });
                                } else {
                                    newBubbles.push({
                                        key: nextKey(),
                                        role: "user",
                                        messageRender: () => (
                                            <MarkdownView content={contentToMarkdown(sub)}/>
                                        ),
                                    });
                                }
                            }
                        } else {
                            newBubbles.push({
                                key: nextKey(),
                                role: "user",
                                messageRender: () => (
                                    <MarkdownView content={contentToMarkdown(msg.content ?? "")}/>
                                ),
                            });
                        }
                        continue;
                    }
                }

                setBubbles(newBubbles);
            } catch (e) {
                console.error(e);
                antdMessage.error("加载历史失败");
            } finally {
                setLoadingHistory(false);
                // 滚动到底
            }
        })();
    }, []);

    /* ---------------- 发送 & SSE（只处理实时消息） ---------------- */
    const handleSubmit = async () => {
        const text = input.trim();
        if (!text) return;

        // 1) 先落一个用户气泡
        const userKey = nextKey();
        setBubbles((prev) => [
            ...prev,
            {
                key: userKey,
                role: "user",
                messageRender: () => <MarkdownView content={text}/>,
            },
        ]);
        setInput("");

        // 2) 建立 SSE
        setSending(true);
        try {
            const resp = await fetch(`${API_BASE}/chat/tokens`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    message: text,
                    thread_id: THREAD_ID,
                    graph_name: GRAPH_NAME,
                    // references / config 如需可加
                }),
            });
            if (!resp.ok || !resp.body) throw new Error(`SSE 连接失败: ${resp.status}`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            let aiKey: React.Key | null = null;

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                buf += decoder.decode(value, {stream: true});

                // 按行切分
                const lines = buf.split("\n");
                buf = lines.pop() ?? ""; // 留给下一个 chunk 的残缺行

                for (const lineRaw of lines) {
                    const line = lineRaw.trim();
                    if (!line.startsWith("data:")) continue;
                    const dataStr = line.replace(/^data:\s*/, "");
                    if (!dataStr || dataStr === "[DONE]") continue;

                    let ev: any;
                    try {
                        ev = JSON.parse(dataStr);
                    } catch {
                        continue;
                    }

                    // 2.1 token 分片
                    if (ev.type === "AIMessageChunk" && ev.content !== undefined) {
                        if (aiKey == null) {
                            aiKey = nextKey();
                            aiContentMap.current[aiKey] = String(ev.content ?? "");
                            setBubbles((prev) => [
                                ...prev,
                                {
                                    key: aiKey!,
                                    role: "ai",
                                    messageRender: () => (
                                        <MarkdownView content={aiContentMap.current[aiKey!]}/>
                                    ),
                                    footer: () => (
                                        <Flex>
                                            <Button
                                                size="small"
                                                type="text"
                                                icon={<CopyOutlined/>}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(aiContentMap.current[aiKey!] || "");
                                                    antdMessage.success("已复制");
                                                }}
                                            />
                                        </Flex>
                                    ),
                                },
                            ]);
                        } else {
                            aiContentMap.current[aiKey] += String(ev.content ?? "");
                            // 触发重渲染：替换 aiKey 对应的气泡的 messageRender（不可原地改）
                            setBubbles((prev) =>
                                prev.map((b) =>
                                    b.key === aiKey
                                        ? {
                                            ...b,
                                            messageRender: () => (
                                                <MarkdownView content={aiContentMap.current[aiKey!]}/>
                                            ),
                                        }
                                        : b
                                )
                            );
                        }
                        continue;
                    }

                    // 2.2 工具调用开始
                    if (ev.type === "custom_tool_call") {
                        const toolId: string =
                            ev.tool_call_id ?? ev.id ?? `tool-${Date.now()}-${Math.random()}`;
                        const name: string =
                            ev.name ?? ev.function?.name ?? ev.tool_name ?? "Tool call";
                        let args: any = ev.args ?? ev.function?.arguments ?? ev.input ?? {};
                        if (typeof args === "string") {
                            try {
                                args = JSON.parse(args);
                            } catch {
                            }
                        }

                        const items: NonNullable<ThoughtChainProps["items"]> = [
                            {
                                title: `调用工具：${name}`,
                                status: ev.status ?? "pending",
                                icon: <LoadingOutlined/>,
                                description:
                                    !args || (typeof args === "object" && Object.keys(args).length === 0)
                                        ? "无参数传入"
                                        : `参数：\n${pretty(args)}`,
                            },
                        ];
                        const bubbleKey = nextKey();
                        toolChainMap.current[toolId] = {bubbleKey, items};

                        setBubbles((prev) => [
                            ...prev,
                            {
                                key: bubbleKey,
                                role: "ai",
                                messageRender: () => <ThoughtChain items={items}/>,
                            },
                        ]);
                        continue;
                    }

                    // 2.3 工具结果
                    if (ev.type === "custom_tool_result") {
                        const toolId: string =
                            ev.tool_call_id ?? ev.id ?? `tool-${Date.now()}-${Math.random()}`;
                        let chain = toolChainMap.current[toolId];

                        // 可能先到 result 再到 call：需要补卡
                        if (!chain) {
                            const bubbleKey = nextKey();
                            chain = {bubbleKey, items: []};
                            toolChainMap.current[toolId] = chain;
                            setBubbles((prev) => [
                                ...prev,
                                {
                                    key: bubbleKey,
                                    role: "ai",
                                    messageRender: () => <ThoughtChain items={chain!.items}/>,
                                },
                            ]);
                        }

                        if (chain.items.length === 0) {
                            chain.items.push({
                                title: ev.name ? `调用工具：${ev.name}` : "工具调用",
                                status: "pending",
                                icon: <LoadingOutlined/>,
                                description: "等待结果…",
                            });
                        }
                        const status = String(ev.status ?? "success").toLowerCase();
                        const ok = status === "success";
                        const raw =
                            ev.content ?? ev.output ?? ev.result ?? ev.data ?? null;
                        const lastIdx = chain.items.length - 1;

                        chain.items[lastIdx] = {
                            ...(chain.items[lastIdx] || {
                                title: ev.name ? `调用工具：${ev.name}` : "工具调用",
                            }),
                            status: ok ? "success" : "error",
                            icon: ok ? <CheckCircleOutlined/> : <FrownOutlined/>,
                            description: typeof raw === "string" ? raw : pretty(raw),
                        };

                        // 触发 ThoughtChain 更新（替换对应 bubble 的 render）
                        const bubbleKey = chain.bubbleKey;
                        setBubbles((prev) =>
                            prev.map((b) =>
                                b.key === bubbleKey
                                    ? {...b, messageRender: () => <ThoughtChain items={chain!.items}/>}
                                    : b
                            )
                        );

                        if (ev.should_cache === true && typeof raw === "string" && ev.name) {
                            try {
                                localStorage.setItem(`tool_result_${ev.name}`, raw);
                            } catch {
                            }
                        }
                        continue;
                    }

                    // 2.4 结束
                    if (ev.type === "end") {
                        // 可以在这里做些清理或提示
                        continue;
                    }
                }
            }
        } catch (e) {
            console.error(e);
            antdMessage.error("发送失败或连接中断");
        } finally {
            setSending(false);
        }
    };

    /* ---------------- 滚动 ---------------- */


    /* ---------------- 渲染 ---------------- */
    return (
        <Flex vertical style={{height: "100%", padding: 16}}>
            <div style={{flex: 1, overflow: "hidden", border: "1px solid #f0f0f0", borderRadius: 8}}>
                <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
                    <div style={{flex: 1, overflowY: "auto", padding: 12}}>
                        <Bubble.List
                            autoScroll
                            ref={listRef}
                            roles={roles}
                            items={bubbles}
                        />
                    </div>

                    <div style={{borderTop: "1px solid #eee", padding: 12}}>
                        <Sender
                            value={input}
                            loading={sending || loadingHistory}
                            placeholder={loadingHistory ? "正在加载历史..." : "请输入内容"}
                            submitType="shiftEnter"
                            onChange={(v) => setInput(String(v ?? ""))}
                            onSubmit={handleSubmit}
                        />
                        <div
                            style={{textAlign: "center", fontSize: 12, color: "#999", marginTop: 8}}
                        >
                            本服务内容由人工智能生成，仅供参考
                        </div>
                    </div>
                </div>
            </div>
        </Flex>
    );
}
