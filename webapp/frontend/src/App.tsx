import DesktopHomePage from "./pages/DesktopHomePage";
import EditorWorkspacePage from "./pages/EditorWorkspacePage";
import FileProcessingPage from "./pages/FileProcessingPage";
import GuidePage from "./pages/GuidePage";
import MarketingLandingPage from "./pages/MarketingLandingPage";

export default function App() {
  const path =
    typeof window !== "undefined"
      ? window.location.pathname.toLowerCase()
      : "/";
  if (path === "/" || path === "") {
    return <MarketingLandingPage />;
  }
  if (
    path === "/workspace" ||
    path === "/workspace/" ||
    path === "/editor" ||
    path === "/editor/"
  ) {
    return <EditorWorkspacePage />;
  }
  if (path === "/guide" || path === "/guide/") {
    return <GuidePage />;
  }
  if (path === "/desktop/windows" || path === "/desktop/windows/") {
    return <DesktopHomePage platform="windows" />;
  }
  if (path === "/desktop/linux" || path === "/desktop/linux/") {
    return <DesktopHomePage platform="linux" />;
  }
  if (path === "/desktop" || path === "/desktop/") {
    return <DesktopHomePage platform="desktop" />;
  }
  if (
    path === "/process" ||
    path === "/process/" ||
    path === "/processing" ||
    path === "/processing/" ||
    path === "/file-processing" ||
    path === "/file-processing/"
  ) {
    return <FileProcessingPage />;
  }
  return <MarketingLandingPage />;
}
