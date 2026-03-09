import EditorWorkspacePage from "./pages/EditorWorkspacePage";
import GuidePage from "./pages/GuidePage";

export default function App() {
  const path =
    typeof window !== "undefined"
      ? window.location.pathname.toLowerCase()
      : "/";
  if (path === "/guide" || path === "/guide/") {
    return <GuidePage />;
  }
  return <EditorWorkspacePage />;
}
