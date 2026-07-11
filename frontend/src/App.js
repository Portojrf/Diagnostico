import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Question from "@/pages/Question";
import Dashboard from "@/pages/Dashboard";
import ThankYou from "@/pages/ThankYou";

function App() {
  return (
    <div className="ps-app">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/question" element={<Question />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/thankyou" element={<ThankYou />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
