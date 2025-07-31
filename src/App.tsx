import ChatWindow from "./components/ChatWindow";
import MemorySidebar from "./components/MemorySidebar";

function App() {
    return (
        <div className="flex h-screen">
            <div className="w-1/2 border-r">
                <MemorySidebar />
            </div>
            <div className="w-1/2">
                <ChatWindow />
            </div>
        </div>
    );
}

export default App;
