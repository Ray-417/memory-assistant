// src/components/MemorySidebar.tsx
import { useState } from "react";
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Settings,
    Trash2,
    CheckCircle,
    X,
    Pencil,
} from "lucide-react";

interface MemoryPoint {
    id: number;
    title: string;
    content: string;
}

interface Project {
    id: number;
    name: string;
    memories: MemoryPoint[];
}

export default function MemorySidebar() {
    const [projects, setProjects] = useState<Project[]>([{
        id: 1,
        name: "Project A",
        memories: [
            { id: 1, title: "Memory 1", content: "This is a long content for memory point 1." },
            { id: 2, title: "Memory 2", content: "Another content memory." },
        ],
    }]);

    const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newProjectName, setNewProjectName] = useState("");
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);
    const [newMemory, setNewMemory] = useState({ title: "", content: "" });
    const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

    const toggleProject = (id: number) => {
        setExpandedProjectId(prev => (prev === id ? null : id));
    };

    const handleDelete = (projectId: number, memoryId: number) => {
        setProjects(prev =>
            prev.map(project =>
                project.id === projectId
                    ? {
                        ...project,
                        memories: project.memories.filter(m => m.id !== memoryId),
                    }
                    : project
            )
        );
    };

    const handleEdit = (projectId: number, memoryId: number, updated: Partial<MemoryPoint>) => {
        setProjects(prev =>
            prev.map(project =>
                project.id === projectId
                    ? {
                        ...project,
                        memories: project.memories.map(m =>
                            m.id === memoryId ? { ...m, ...updated } : m
                        ),
                    }
                    : project
            )
        );
        setEditingId(null);
    };

    const handleAddProject = () => {
        if (!newProjectName.trim()) return;
        setProjects(prev => [...prev, { id: Date.now(), name: newProjectName, memories: [] }]);
        setNewProjectName("");
        setShowNewProjectModal(false);
    };

    const handleAddMemory = () => {
        if (!newMemory.title.trim()) return;
        setProjects(prev =>
            prev.map(project =>
                project.id === currentProjectId
                    ? {
                        ...project,
                        memories: [
                            ...project.memories,
                            { id: Date.now(), ...newMemory },
                        ],
                    }
                    : project
            )
        );
        setNewMemory({ title: "", content: "" });
        setShowAddMemoryModal(false);
    };

    return (
        <div className="p-4 overflow-y-auto h-full relative bg-white">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold">Memory Library</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowNewProjectModal(true)} title="Add Project">
                        <Plus size={18} />
                    </button>
                    <button onClick={() => setShowManageModal(true)} title="Manage Projects">
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            <hr className="mb-4" />

            {projects.map(project => (
                <div key={project.id} className="mb-4 group">
                    <div
                        className="flex items-center justify-between cursor-pointer text-gray-600 hover:bg-gray-100 px-1 py-1 rounded"
                        onClick={() => toggleProject(project.id)}
                    >
                        <div className="flex items-center gap-1">
                            {expandedProjectId === project.id ? (
                                <ChevronDown size={14} />
                            ) : (
                                <ChevronRight size={14} />
                            )}
                            <span className="font-medium">{project.name}</span>
                        </div>
                    </div>

                    {expandedProjectId === project.id && (
                        <div className="ml-4 mt-2 space-y-3">
                            {project.memories.map(memory => (
                                <div
                                    key={memory.id}
                                    className="bg-gray-50 p-3 rounded-lg shadow-sm hover:shadow-md border hover:border-gray-300 transition-all"
                                >
                                    {editingId === memory.id ? (
                                        <div className="space-y-2">
                                            <input
                                                className="border w-full px-2 py-1 rounded"
                                                defaultValue={memory.title}
                                                onBlur={e =>
                                                    handleEdit(project.id, memory.id, {
                                                        title: e.target.value,
                                                    })
                                                }
                                                autoFocus
                                            />
                                            <textarea
                                                className="border w-full px-2 py-1 rounded"
                                                rows={2}
                                                defaultValue={memory.content}
                                                onBlur={e =>
                                                    handleEdit(project.id, memory.id, {
                                                        content: e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="font-semibold text-sm">
                                                    {memory.title}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="text-gray-500 hover:text-red-500"
                                                        onClick={() => handleDelete(project.id, memory.id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button
                                                        className="text-gray-500 hover:text-blue-500"
                                                        onClick={() => setEditingId(memory.id)}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-600 truncate">
                                                {memory.content.length > 100
                                                    ? memory.content.slice(0, 100) + "..."
                                                    : memory.content}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            <div
                                onClick={() => {
                                    setShowAddMemoryModal(true);
                                    setCurrentProjectId(project.id);
                                }}
                                className="border border-dashed border-gray-300 text-center cursor-pointer p-3 rounded-lg hover:bg-gray-100"
                            >
                                <Plus size={16} className="inline-block mr-1" /> Add Memory
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* 新增项目 Modal */}
            {showNewProjectModal && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-10">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-72 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">New Project</h3>
                            <button onClick={() => setShowNewProjectModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <input
                            className="border px-3 py-2 w-full"
                            placeholder="Enter project name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                        />
                        <button
                            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                            onClick={handleAddProject}
                        >
                            Add Project
                        </button>
                    </div>
                </div>
            )}

            {/* 管理项目 Modal */}
            {showManageModal && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-10">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Manage Projects</h3>
                            <button onClick={() => setShowManageModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {projects.map((p) => (
                                <li key={p.id} className="text-gray-700 px-2">
                                    {p.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* 新增记忆点 Modal */}
            {showAddMemoryModal && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-10">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-[400px] space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">New Memory</h3>
                            <button onClick={() => setShowAddMemoryModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <input
                            className="border px-3 py-2 w-full"
                            placeholder="Enter memory title"
                            value={newMemory.title}
                            onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
                        />
                        <textarea
                            className="border px-3 py-2 w-full"
                            rows={3}
                            placeholder="Enter memory content"
                            value={newMemory.content}
                            onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                        />
                        <button
                            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                            onClick={handleAddMemory}
                        >
                            Add Memory
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
