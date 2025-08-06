import { useEffect, useState } from "react";
import axios from "axios";
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Settings,
    Trash2,
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
    const [projects, setProjects] = useState<Project[]>([]);
    const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editingProjectName, setEditingProjectName] = useState("");
    const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null);
    const [newProjectName, setNewProjectName] = useState("");
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);
    const [newMemory, setNewMemory] = useState({ title: "", content: "" });
    const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

    const fetchProjects = async () => {
        try {
            const res = await axios.get("http://localhost:8000/api/projects");
            const projectsWithMemories = await Promise.all(
                res.data.map(async (project: any) => {
                    const memoryRes = await axios.get(
                        `http://localhost:8000/api/projects/${project.id}/memories`
                    );
                    return {
                        id: project.id,
                        name: project.name,
                        memories: memoryRes.data,
                    };
                })
            );
            setProjects(projectsWithMemories);
        } catch (err) {
            console.error("Failed to load projects:", err);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const toggleProject = (id: number) => {
        setExpandedProjectId(prev => (prev === id ? null : id));
    };

    const handleDelete = async (_projectId: number, memoryId: number) => {
        try {
            await axios.delete(`http://localhost:8000/api/memories/${memoryId}`);
            await fetchProjects();
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const handleEditMemoryTitle = async (_projectId: number, memoryId: number, newTitle: string) => {
        try {
            await axios.put(`http://localhost:8000/api/memories/${memoryId}`, {
                title: newTitle,
            });
            await fetchProjects();
            setEditingMemoryId(null);
        } catch (err) {
            console.error("Edit memory title failed:", err);
        }
    };

    const handleEditProjectName = async (projectId: number, name: string) => {
        try {
            await axios.put(`http://localhost:8000/api/projects/${projectId}`, {
                name,
            });
            await fetchProjects();
            setEditingProjectId(null);
        } catch (err) {
            console.error("Edit project name failed:", err);
        }
    };

    const handleAddProject = async () => {
        if (!newProjectName.trim()) return;
        try {
            await axios.post("http://localhost:8000/api/projects", {
                name: newProjectName,
            });
            await fetchProjects();
            setNewProjectName("");
            setShowNewProjectModal(false);
        } catch (err) {
            console.error("Add project failed:", err);
        }
    };

    const handleAddMemory = async () => {
        if (!newMemory.title.trim() || !currentProjectId) return;
        try {
            await axios.post(`http://localhost:8000/api/memories`, {
                project_id: currentProjectId,
                title: newMemory.title,
                content: newMemory.content,
            });
            await fetchProjects();
            setNewMemory({ title: "", content: "" });
            setShowAddMemoryModal(false);
        } catch (err) {
            console.error("Add memory failed:", err);
        }
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
                    <div className="flex items-center justify-between cursor-pointer text-gray-600 hover:bg-gray-100 px-1 py-1 rounded">
                        <div className="flex items-center gap-1" onClick={() => toggleProject(project.id)}>
                            {expandedProjectId === project.id ? (
                                <ChevronDown size={14} />
                            ) : (
                                <ChevronRight size={14} />
                            )}
                            {editingProjectId === project.id ? (
                                <input
                                    className="border px-1 py-0.5 rounded text-sm"
                                    autoFocus
                                    defaultValue={project.name}
                                    onBlur={(e) =>
                                        handleEditProjectName(project.id, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleEditProjectName(project.id, (e.target as HTMLInputElement).value);
                                        }
                                    }}
                                />
                            ) : (
                                <span className="font-medium">{project.name}</span>
                            )}
                        </div>
                        <button
                            className="text-gray-400 hover:text-blue-500"
                            onClick={() => {
                                setEditingProjectId(project.id);
                                setEditingProjectName(project.name);
                            }}
                        >
                            <Pencil size={14} />
                        </button>
                    </div>

                    {expandedProjectId === project.id && (
                        <div className="ml-4 mt-2 space-y-3">
                            {project.memories.map(memory => (
                                <div
                                    key={memory.id}
                                    className="bg-gray-50 p-3 rounded-lg shadow-sm hover:shadow-md border hover:border-gray-300 transition-all"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        {editingMemoryId === memory.id ? (
                                            <input
                                                className="font-semibold text-sm border px-1 py-0.5 rounded w-[60%] max-w-[140px]"
                                                defaultValue={memory.title}
                                                autoFocus
                                                onBlur={(e) =>
                                                    handleEditMemoryTitle(project.id, memory.id, e.target.value)
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        handleEditMemoryTitle(
                                                            project.id,
                                                            memory.id,
                                                            (e.target as HTMLInputElement).value
                                                        );
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div
                                                className="font-semibold text-sm border px-1 py-0.5 rounded w-[60%] max-w-[140px]"
                                                onClick={() => setEditingMemoryId(memory.id)}
                                            >
                                                {memory.title}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                className="text-gray-500 hover:text-red-500"
                                                onClick={() => handleDelete(project.id, memory.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <button
                                                className="text-gray-500 hover:text-blue-500"
                                                onClick={() => setEditingMemoryId(memory.id)}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 记忆点内容始终显示 */}
                                    <div className="text-xs text-gray-600 truncate">
                                        {memory.content.length > 100
                                            ? memory.content.slice(0, 100) + "..."
                                            : memory.content}
                                    </div>
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

            {/* New Project Modal */}
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

            {/* Manage Modal */}
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

            {/* Add Memory Modal */}
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
