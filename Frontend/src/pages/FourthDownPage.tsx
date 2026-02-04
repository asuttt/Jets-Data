import { useEffect, useMemo, useState } from "react";
import { loadCsv } from "../lib/csv";
import { buildDataUrl } from "../lib/dataSource";

type GameRow = {
  game_id: string;
  week: string;
  opponent: string;
  home_away: string;
  game_date: string;
};

type CardRow = {
  game_id: string;
  clock_display: string;
  score_display: string;
  down_distance: string;
  field_position_display: string;
  decision: string;
  best_decision: string;
  decision_matches_best: string;
  low_sample_flag: string;
  exp_wp_go: string;
  exp_wp_punt: string;
  exp_wp_field_goal: string;
  exp_wp_best_minus_actual: string;
  desc: string;
};

const rangeOptions = [
  { label: "2016–2024", value: "2016_2024" },
  { label: "2018–2024", value: "2018_2024" },
  { label: "2020–2024", value: "2020_2024" },
];

const teamLogoMap: Record<string, string> = {
  BUF: "/NFL Team Logos/BUF.png",
  MIA: "/NFL Team Logos/MIA.png",
  NE: "/NFL Team Logos/NE.png",
  NYJ: "/NFL Team Logos/NYJ.png",
  BAL: "/NFL Team Logos/BAL.png",
  CIN: "/NFL Team Logos/CIN.png",
  CLE: "/NFL Team Logos/CLE.png",
  PIT: "/NFL Team Logos/PIT.png",
  HOU: "/NFL Team Logos/HOU.png",
  IND: "/NFL Team Logos/IND.png",
  JAX: "/NFL Team Logos/JAX.png",
  TEN: "/NFL Team Logos/TEN.png",
  DEN: "/NFL Team Logos/DEN.png",
  KC: "/NFL Team Logos/KC.png",
  LAC: "/NFL Team Logos/LAC.png",
  LV: "/NFL Team Logos/LV.png",
  DAL: "/NFL Team Logos/DAL.png",
  NYG: "/NFL Team Logos/NYG.png",
  PHI: "/NFL Team Logos/PHI.png",
  WAS: "/NFL Team Logos/WAS.png",
  CHI: "/NFL Team Logos/CHI.png",
  DET: "/NFL Team Logos/DET.png",
  GB: "/NFL Team Logos/GB.png",
  MIN: "/NFL Team Logos/MIN.png",
  ATL: "/NFL Team Logos/ATL.png",
  CAR: "/NFL Team Logos/CAR.png",
  NO: "/NFL Team Logos/NO.png",
  TB: "/NFL Team Logos/TB.png",
  ARI: "/NFL Team Logos/ARI.png",
  LAR: "/NFL Team Logos/LAR.png",
  SF: "/NFL Team Logos/SF.png",
  SEA: "/NFL Team Logos/SEA.png",
};

function getTeamLogo(abbrev?: string) {
  if (!abbrev) return null;
  return teamLogoMap[abbrev.toUpperCase()] ?? null;
}

function formatPercent(value?: string) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  return `${(num * 100).toFixed(1)}%`;
}

function formatDelta(value?: string) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  const sign = num >= 0 ? "+" : "";
  return `${sign}${(num * 100).toFixed(1)}%`;
}

export default function FourthDownPage() {
  const [range, setRange] = useState(rangeOptions[0].value);
  const [games, setGames] = useState<GameRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setError(null);
        const gamesData = await loadCsv<GameRow>(buildDataUrl("nyj_2025_games.csv"));
        let cardsData: CardRow[] = [];
        try {
          cardsData = await loadCsv<CardRow>(
            buildDataUrl(`nyj_2025_fourth_down_cards_${range}.csv`)
          );
        } catch {
          cardsData = await loadCsv<CardRow>(
            buildDataUrl("nyj_2025_fourth_down_cards.csv")
          );
        }

        if (!mounted) return;
        setGames(gamesData);
        setCards(cardsData);
        if (!activeGame && gamesData.length) {
          setActiveGame(gamesData[0].game_id);
        }
      } catch (err) {
        if (!mounted) return;
        setError("Data not found. Copy CSVs into Frontend/public/data.");
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, [range, activeGame]);

  const activeCards = useMemo(() => {
    if (!activeGame) return [];
    return cards
      .filter((card) => card.game_id === activeGame)
      .sort((a, b) => {
        const qtrA = Number(a.clock_display?.split(" ")[0]?.replace("Q", ""));
        const qtrB = Number(b.clock_display?.split(" ")[0]?.replace("Q", ""));
        if (Number.isNaN(qtrA) || Number.isNaN(qtrB)) return 0;
        return qtrB - qtrA;
      });
  }, [cards, activeGame]);

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">4th Down Decision Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Review every Jets 4th down by game & compare decision recommendations
        </p>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Select Game</p>
              <p className="text-xs text-muted-foreground">Choose a week to view its 4th-down cards.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {games.map((game) => (
              <button
                key={game.game_id}
                type="button"
                onClick={() => setActiveGame(game.game_id)}
                className={[
                  "flex items-center justify-between gap-3 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                  activeGame === game.game_id
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground/80 hover:bg-primary hover:text-primary-foreground",
                ].join(" ")}
              >
                <span>Week {game.week}</span>
                {getTeamLogo(game.opponent) ? (
                  <img
                    src={getTeamLogo(game.opponent) as string}
                    alt={game.opponent}
                    className="h-5 w-5 rounded-full bg-white object-contain"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full rounded-2xl border border-border bg-white px-4 py-3 shadow-sm lg:w-64">
          <p className="text-sm font-semibold text-foreground">Backtest Range</p>
          <p className="text-xs text-muted-foreground">
            Select a historical range to compare.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={[
                  "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                  range === option.value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground/80 hover:bg-primary hover:text-primary-foreground",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-white px-4 py-6 text-sm text-muted-foreground shadow-sm">
          {error}
        </div>
      ) : (
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {activeCards.map((card, idx) => (
            <div key={`${card.game_id}-${idx}`} className="flip-card group">
              <div className="flip-inner">
                <div className="flip-face rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl border border-border bg-white p-1">
                        <img
                          src="/NFL Team Logos/NYJ.png"
                          alt="NYJ"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {card.clock_display || "Qx - --:--"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {card.score_display || "Score context"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs font-semibold text-foreground">
                      <p>{card.down_distance || "4th & --"}</p>
                      <p className="text-muted-foreground">
                        {card.field_position_display || "OPP --"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span>Win %</span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-border bg-white px-2 py-1 text-[11px] font-semibold">
                          P {formatPercent(card.exp_wp_punt)}
                        </span>
                        <span className="rounded-full border border-border bg-white px-2 py-1 text-[11px] font-semibold">
                          FG {formatPercent(card.exp_wp_field_goal)}
                        </span>
                        <span className="rounded-full border border-border bg-white px-2 py-1 text-[11px] font-semibold">
                          Go {formatPercent(card.exp_wp_go)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span>Recommendation</span>
                      <span className="rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
                        {card.best_decision || "TBD"} ({formatDelta(card.exp_wp_best_minus_actual)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span>Decision</span>
                      <span className="rounded-full bg-black px-2 py-1 text-[11px] font-semibold text-white">
                        {card.decision || "TBD"}
                      </span>
                    </div>
                    {card.low_sample_flag === "True" && (
                      <div className="rounded-lg border border-border bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                        Low sample size warning
                      </div>
                    )}
                  </div>
                </div>

                <div className="flip-face flip-back rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Field Goal Chance</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.exp_wp_field_goal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>First Down Chance</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.exp_wp_go)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Break-even</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.exp_wp_punt)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      {card.desc || "Play description placeholder."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
