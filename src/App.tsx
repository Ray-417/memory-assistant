import ChatWindow from "./components/ChatWindow";

function App() {
    return (
        <div className="flex h-screen">
            <div className="w-1/2 border-r">左侧记忆点库</div>
            <div className="w-1/2">
                <ChatWindow />
            </div>
        </div>
    );
}

export default App;