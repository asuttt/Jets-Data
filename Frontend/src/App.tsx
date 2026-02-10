import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import FourthDownPage from "./pages/FourthDownPage";
import TakeawaysPage from "./pages/TakeawaysPage";
import primaryLogo from "./assets/Primary Logo.png";

const navItems = [
  { label: "4th Down", to: "/fourth-down" },
  { label: "INT", to: "/takeaways" },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="relative mx-auto max-w-6xl px-6 py-4 sm:pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={primaryLogo} alt="Jets Data Analytics Tool" className="h-10 w-auto" />
              <div className="hidden sm:block">
                <div className="text-2xl font-bold text-foreground">2025 Data Analytics Tool</div>
                <div className="text-sm italic text-muted-foreground">Private Demo</div>
              </div>
            </div>
          </div>
          <nav className="mt-2 flex items-end justify-end overflow-x-auto sm:absolute sm:bottom-[-1px] sm:right-6 sm:mt-0">
            {navItems.map((item, idx) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "relative min-h-0 rounded-t-xl border border-b-transparent px-5 py-2 text-sm font-semibold transition-colors",
                  idx > 0 ? "-ml-1" : "",
                  isActive
                    ? "z-20 border-[hsl(160_66%_21%/.55)] bg-primary text-primary-foreground shadow-sm"
                    : "z-10 border-border bg-muted/60 text-foreground/80 hover:bg-muted",
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
        <p className="mt-8 text-center text-xs text-muted-foreground/80">
          &copy; 2026 Arseni Sutton. All rights reserved. Duplication or reuse is strictly prohibited. Data sourced from nflfastR. Logos are property of New York Jets, LLC
        </p>
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
