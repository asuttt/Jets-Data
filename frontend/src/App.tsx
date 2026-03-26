import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import FourthDownPage from "./pages/FourthDownPage";
import TakeawaysPage from "./pages/TakeawaysPage";
import primaryLogo from "./assets/Primary Logo.png";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { label: "4th Down", to: "/fourth-down" },
  { label: "INT", to: "/takeaways" },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="relative mx-auto max-w-6xl px-4 pt-3 pb-12 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <img src={primaryLogo} alt="Jets Data Analytics Tool" className="h-8 w-auto sm:h-10" />
              <div className="min-w-0">
                <div className="truncate text-base font-bold leading-tight text-foreground sm:text-2xl">
                  2025 Data Analytics Tool
                </div>
                <div className="truncate text-xs italic text-muted-foreground sm:text-sm">Demo purposes only</div>
              </div>
            </div>
          </div>

          <nav className="absolute bottom-[-1px] right-6 hidden items-end justify-end overflow-x-auto sm:flex">
            {navItems.map((item, idx) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "relative min-h-0 rounded-t-xl border border-b-transparent px-4 py-2 text-sm font-semibold transition-colors sm:px-5",
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

          <nav className="absolute bottom-0 left-4 right-4 flex translate-y-px items-end justify-end sm:hidden">
            {navItems.map((item, idx) => (
              <NavLink
                key={`mobile-${item.to}`}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "relative min-h-0 w-[140px] rounded-t-xl border border-b-transparent px-3 py-2 text-center text-base font-semibold transition-colors",
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
      <main className="mx-auto max-w-6xl px-6 pt-4 pb-8 sm:pt-5">
        <Outlet />
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground/85 hover:text-foreground"
              >
                Methodology &amp; Evaluation
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:w-[480px] sm:max-w-[480px] sm:p-6">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="text-xl">Methodology &amp; Evaluation</SheetTitle>
                <SheetDescription>
                  High-level summary of how the 4th Down and INT outputs are built and evaluated
                </SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4 text-sm text-foreground/90">
                <section className="space-y-1">
                  <h3 className="font-semibold">Data Scope</h3>
                  <p>
                    Public, nflfastR, regular season, play-by-play data (2016–2025), with Jets 2025 used as the operational review set
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Decision Framework</h3>
                  <p>
                    4th-down recommendations compare expected win probability for GO, Field Goal, and Punt in similar historical contexts
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Backtesting Windows</h3>
                  <p>
                    Baseline window is 2016-2024, with alternate windows 2018-2024 and 2020-2024 available in the UI for sensitivity checks
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Recency Weighting</h3>
                  <p>
                    Newer seasons are weighted more heavily than older seasons to better reflect current league decision behavior
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Leakage Prevention</h3>
                  <p>
                    No future-season information is used when evaluating earlier seasons; holdout evaluation is kept season-safe
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Calibration &amp; Uncertainty</h3>
                  <p>
                    Low-sample flags indicate recommendations based on limited historical comparables and lower confidence
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">INT Model Scope</h3>
                  <p>
                    Outputs estimate interception opportunities from pass-defense process signals, then compare expected versus actual takeaways on a per-game, per-drive, and per-play basis
                  </p>
                </section>
                <section className="space-y-1">
                  <h3 className="font-semibold">Limitations</h3>
                  <p>
                    Outputs do not include full coach, roster, kicker, or weather context. This is decision support, not a deterministic play-calling rule
                  </p>
                </section>
              </div>
            </SheetContent>
          </Sheet>
          <p className="text-center text-xs leading-tight text-muted-foreground/65">
            &copy; 2026 Arseni Sutton. All rights reserved. Duplication or reuse is strictly prohibited. Data sourced from nflfastR. Logos are property of New York Jets, LLC
          </p>
        </div>
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
