import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import FourthDownPage from "./pages/FourthDownPage";
import TakeawaysPage from "./pages/TakeawaysPage";
import primaryLogo from "./assets/Primary Logo.png";

const navItems = [
  { label: "4th Downs", to: "/fourth-down" },
  { label: "INT Opps", to: "/takeaways" },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={primaryLogo} alt="Jets Data Analytics Tool" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <div className="text-lg font-semibold text-foreground">2025 Data Analytics Tool</div>
              <div className="text-sm text-muted-foreground">Internal Demo</div>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:text-foreground hover:bg-muted",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/fourth-down" replace />} />
        <Route path="/fourth-down" element={<FourthDownPage />} />
        <Route path="/takeaways" element={<TakeawaysPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
