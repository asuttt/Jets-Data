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
  exp_wp_go_display: string;
  exp_wp_punt_display: string;
  exp_wp_field_goal_display: string;
  exp_wp_recommendation_edge: string;
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

function formatDecisionLabel(value?: string) {
  if (!value) return "TBD";
  const normalized = value.trim().toLowerCase();
  if (normalized === "punt") return "Punt";
  if (normalized === "go") return "GO";
  if (normalized === "field_goal" || normalized === "field goal") return "Field Goal";
  return value;
}

function normalizeDecision(value?: string) {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "field goal") return "field_goal";
  return normalized;
}

function actionChipClass(action?: string) {
  const normalized = normalizeDecision(action);
  if (normalized === "punt") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (normalized === "field_goal") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (normalized === "go") {
    return "border-[hsl(160_66%_21%/.20)] bg-[hsl(160_66%_21%/.08)] text-primary";
  }
  return "border-border bg-white text-foreground";
}

function gameElapsedSeconds(clockDisplay?: string) {
  if (!clockDisplay) return -1;
  const match = clockDisplay.match(/^Q(\d)\s*-\s*(\d{1,2}):(\d{2})$/i);
  if (!match) return -1;
  const qtr = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if ([qtr, minutes, seconds].some(Number.isNaN)) return -1;
  const timeLeftInQuarter = minutes * 60 + seconds;
  return (qtr - 1) * 900 + (900 - timeLeftInQuarter);
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
        const elapsedA = gameElapsedSeconds(a.clock_display);
        const elapsedB = gameElapsedSeconds(b.clock_display);
        return elapsedB - elapsedA;
      });
  }, [cards, activeGame]);

  const weekSlots = useMemo(() => {
    const byWeek = new Map<number, GameRow>();
    for (const game of games) {
      const week = Number(game.week);
      if (!Number.isNaN(week)) {
        byWeek.set(week, game);
      }
    }
    return Array.from({ length: 18 }, (_, i) => {
      const week = i + 1;
      return { week, game: byWeek.get(week) ?? null };
    });
  }, [games]);

  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">4th Down Decision Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Review every Jets 4th down by game & compare decision recommendations
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-3 px-0">
        <div className="space-y-2">
          <div className="overflow-hidden rounded-full border border-border bg-white">
            <div
              className="grid w-full items-stretch [grid-template-columns:repeat(18,minmax(0,1fr))] xl:justify-center xl:[grid-template-columns:64px_repeat(16,56px)_64px]"
            >
              {weekSlots.map((slot, index) => {
                const game = slot.game;
                if (!game) {
                  return (
                    <div
                      key={`week-${slot.week}`}
                      className={[
                        "flex w-full flex-col items-center justify-center gap-1 px-3 py-4 text-xs font-semibold text-muted-foreground",
                        index !== 0 ? "border-l border-border" : "",
                      ].join(" ")}
                    >
                      <span>{slot.week}</span>
                      <span className="text-[10px]">Bye</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={game.game_id}
                    type="button"
                    onClick={() => setActiveGame(game.game_id)}
                    className={[
                      "flex w-full flex-col items-center justify-center gap-1 px-3 py-4 text-xs font-semibold transition-colors",
                      index !== 0 ? "border-l border-border" : "",
                      activeGame === game.game_id
                        ? "bg-primary text-primary-foreground"
                        : "bg-white text-foreground/80 hover:bg-muted",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex flex-col items-center gap-1",
                        index === 0 ? "translate-x-[5px]" : "",
                        index === weekSlots.length - 1 ? "-translate-x-[5px]" : "",
                      ].join(" ")}
                    >
                      <span>{slot.week}</span>
                      {getTeamLogo(game.opponent) ? (
                        <img
                          src={getTeamLogo(game.opponent) as string}
                          alt={game.opponent}
                          className="h-5 w-5 object-contain"
                        />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Testing Range</p>
          <div className="flex flex-wrap gap-3">
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={[
                  "rounded-full border px-5 py-2 text-xs font-semibold transition-colors",
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
        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                        {[
                          { label: "P", value: card.exp_wp_punt_display, action: "punt" },
                          { label: "FG", value: card.exp_wp_field_goal_display, action: "field_goal" },
                          { label: "GO", value: card.exp_wp_go_display, action: "go" },
                        ]
                          .filter((chip) => {
                            const num = Number(chip.value);
                            return !Number.isNaN(num) && num > 0;
                          })
                          .map((chip) => (
                            <span
                              key={chip.label}
                              className={[
                                "rounded-full border px-2 py-1 text-[11px] font-semibold",
                                actionChipClass(chip.action),
                              ].join(" ")}
                            >
                              {chip.label} {formatPercent(chip.value)}
                            </span>
                          ))}
                        {[
                          card.exp_wp_punt_display,
                          card.exp_wp_field_goal_display,
                          card.exp_wp_go_display,
                        ].every((value) => {
                          const num = Number(value);
                          return Number.isNaN(num) || num <= 0;
                        }) && <span className="text-[11px] font-semibold text-muted-foreground">--</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span>Recommendation</span>
                      <div className="flex items-center gap-2">
                        {card.low_sample_flag === "True" && (
                          <div className="inline-flex">
                            <button
                              type="button"
                              className="inline-flex h-5 min-h-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-2 text-[12px] font-bold leading-none text-amber-900 shadow-sm"
                            >
                              <span className="relative mt-[1px]">⚠</span>
                            </button>
                          </div>
                        )}
                        <span
                          className={[
                            "rounded-full border px-2 py-1 text-[11px] font-semibold",
                            actionChipClass(card.best_decision),
                          ].join(" ")}
                        >
                          {formatDecisionLabel(card.best_decision)} ({formatDelta(card.exp_wp_recommendation_edge)})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span>Decision</span>
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[11px] font-semibold",
                          actionChipClass(card.decision),
                        ].join(" ")}
                      >
                        {formatDecisionLabel(card.decision)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flip-face flip-back h-full rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <div className="h-full space-y-4 overflow-y-auto pr-1 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Field Goal Chance</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.exp_wp_field_goal_display)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>First Down Chance</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.exp_wp_go_display)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Break-even</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.exp_wp_punt_display)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      {card.desc || "Play description placeholder."}
                    </div>
                    {card.low_sample_flag === "True" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Low sample flag: this recommendation has limited historical comparables
                      </div>
                    )}
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
