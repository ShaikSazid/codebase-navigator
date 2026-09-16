import { BrowserRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AnalysisPage from "./pages/AnalysisPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/analysis/:jobId"
          element={<AnalysisPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;