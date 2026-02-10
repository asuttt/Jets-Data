import { useEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
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
  field_goal_chance: string;
  first_down_chance: string;
  break_even_first_down_chance: string;
  break_even_conflict_flag: string;
  break_even_conflict_reason: string;
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

function formatPercentChip(value?: string) {
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

function formatDecisionShortLabel(value?: string) {
  if (!value) return "TBD";
  const normalized = value.trim().toLowerCase();
  if (normalized === "punt") return "P";
  if (normalized === "go") return "GO";
  if (normalized === "field_goal" || normalized === "field goal") return "FG";
  return value;
}

function normalizeDecision(value?: string) {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "field goal") return "field_goal";
  return normalized;
}

function breakEvenTooltipMessage(conflictFlag?: string) {
  if (conflictFlag === "True") {
    return "The minimum first down chance that favors GO.\n\nWarning: break-even check disagrees with recommended action.";
  }
  return "The minimum first down chance that favors GO.";
}

type BreakEvenTooltipState = {
  x: number;
  y: number;
  conflict: boolean;
};

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
  const [breakEvenTooltip, setBreakEvenTooltip] = useState<BreakEvenTooltipState | null>(null);
  const [showRailTopFade, setShowRailTopFade] = useState(false);
  const [showRailBottomFade, setShowRailBottomFade] = useState(true);
  const weekListRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const list = weekListRef.current;
    if (!list) return;

    const updateFade = () => {
      const hasAbove = list.scrollTop > 1;
      const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
      const hasBelow = remaining > 1;
      setShowRailTopFade(hasAbove);
      setShowRailBottomFade(hasBelow);
    };

    updateFade();
    list.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    return () => {
      list.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [games, range]);

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

  const showBreakEvenTooltip = (
    event: ReactMouseEvent<HTMLButtonElement> | ReactFocusEvent<HTMLButtonElement>,
    conflictFlag?: string
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipRightShift = 15;
    const left = Math.min(
      window.innerWidth - tooltipWidth - 12,
      Math.max(12, rect.left + rect.width / 2 - tooltipWidth / 2 + tooltipRightShift)
    );
    const top = Math.max(12, rect.top - 10);
    setBreakEvenTooltip({
      x: left,
      y: top,
      conflict: conflictFlag === "True",
    });
  };

  const hideBreakEvenTooltip = () => {
    setBreakEvenTooltip(null);
  };

  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <h1 className="text-xl font-medium text-foreground">4th Down Decision Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Review every 4th down of the season by game & compare decision recommendations
        </p>
      </div>

      {error ? (
        <div className="mx-auto max-w-[1320px] rounded-2xl border border-border bg-white px-4 py-6 text-sm text-muted-foreground shadow-sm">
          {error}
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-[1320px] items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-border bg-white p-4 shadow-sm lg:sticky lg:top-24">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Game Selector</h2>
                <p className="mt-1 text-xs text-muted-foreground">Week and opponent</p>
                <select
                  value={activeGame ?? ""}
                  onChange={(event) => setActiveGame(event.target.value)}
                  className="mt-3 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none ring-0 focus:border-primary lg:hidden"
                >
                  {weekSlots.map((slot) => {
                    if (!slot.game) {
                      return (
                        <option key={`mobile-week-${slot.week}`} disabled value={`bye-${slot.week}`}>
                          Week {slot.week} - BYE
                        </option>
                      );
                    }
                    return (
                      <option key={slot.game.game_id} value={slot.game.game_id}>
                        Week {slot.week} - {slot.game.opponent}
                      </option>
                    );
                  })}
                </select>
                <div className="relative mt-3 hidden lg:block">
                  <div ref={weekListRef} className="scrollbar-none max-h-[460px] space-y-2 overflow-y-auto pr-1">
                    {weekSlots.map((slot) => {
                      const game = slot.game;
                      if (!game) {
                        return (
                          <div
                            key={`week-${slot.week}`}
                            className="flex min-h-[44px] items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                          >
                            <span className="font-medium">Week {slot.week}</span>
                            <span>BYE</span>
                          </div>
                        );
                      }

                      const logo = getTeamLogo(game.opponent);
                      return (
                        <button
                          key={game.game_id}
                          type="button"
                          onClick={() => setActiveGame(game.game_id)}
                          className={[
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                            activeGame === game.game_id
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border bg-white text-foreground/80 hover:bg-muted",
                          ].join(" ")}
                        >
                          <span>Week {slot.week}</span>
                          <span className="flex items-center gap-2">
                            <span>{game.opponent}</span>
                            {logo ? (
                              <img src={logo} alt={game.opponent} className="h-7 w-7 object-contain" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {showRailTopFade ? (
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white via-white/80 to-transparent" />
                  ) : null}
                  {showRailBottomFade ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent" />
                  ) : null}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <label htmlFor="testing-range" className="text-sm font-semibold text-foreground">
                  Testing Range
                </label>
                <select
                  id="testing-range"
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none ring-0 focus:border-primary"
                >
                  {rangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>

          <div className="self-start grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {activeCards.map((card, idx) => {
              const winChips = [
                { label: "P", value: card.exp_wp_punt_display, action: "punt" },
                { label: "FG", value: card.exp_wp_field_goal_display, action: "field_goal" },
                { label: "GO", value: card.exp_wp_go_display, action: "go" },
              ].filter((chip) => {
                const num = Number(chip.value);
                return !Number.isNaN(num) && num > 0;
              });
              const hasThreeWinChips = winChips.length >= 3;

              return (
            <div key={`${card.game_id}-${idx}`} className="flip-card group h-full">
              <div className="flip-inner h-full">
                <div className="flip-face flex h-full flex-col rounded-2xl border border-border bg-white p-5 shadow-sm">
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
                    <div
                      className={[
                        "grid min-h-[44px] grid-cols-[74px_minmax(0,1fr)] rounded-lg border border-border bg-muted/40 px-3 py-2",
                        hasThreeWinChips ? "items-center xl:min-h-[72px] xl:items-start" : "items-center",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "shrink-0 whitespace-nowrap",
                          hasThreeWinChips ? "xl:pt-[1px]" : "",
                        ].join(" ")}
                      >
                        Win %
                      </span>
                      <div
                        className={[
                          "flex min-w-0 items-center justify-end gap-1",
                          hasThreeWinChips ? "flex-nowrap xl:flex-wrap" : "flex-nowrap",
                        ].join(" ")}
                      >
                        {winChips.map((chip) => (
                            <span
                              key={chip.label}
                              className={[
                                "whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                actionChipClass(chip.action),
                              ].join(" ")}
                            >
                              {chip.label} {formatPercentChip(chip.value)}
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
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span className="shrink-0 whitespace-nowrap">Recommendation</span>
                      <div className="flex min-w-0 items-center justify-end gap-1">
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
                          title={formatDecisionLabel(card.best_decision)}
                          className={[
                            "whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            actionChipClass(card.best_decision),
                          ].join(" ")}
                        >
                          {formatDecisionShortLabel(card.best_decision)} ({formatDelta(card.exp_wp_recommendation_edge)})
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <span className="shrink-0 whitespace-nowrap">Decision</span>
                      <div className="flex min-w-0 justify-end">
                        <span
                          title={formatDecisionLabel(card.decision)}
                          className={[
                            "whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            actionChipClass(card.decision),
                          ].join(" ")}
                        >
                          {formatDecisionLabel(card.decision)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flip-face flip-back h-full rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <div className="scrollbar-none h-full space-y-4 overflow-y-auto pr-1 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Field Goal Chance</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.field_goal_chance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>First Down Chance</span>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.first_down_chance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span>Break-even</span>
                        <button
                          type="button"
                          onMouseEnter={(event) => showBreakEvenTooltip(event, card.break_even_conflict_flag)}
                          onMouseLeave={hideBreakEvenTooltip}
                          onFocus={(event) => showBreakEvenTooltip(event, card.break_even_conflict_flag)}
                          onBlur={hideBreakEvenTooltip}
                          className={[
                            "inline-flex h-auto min-h-0 items-center justify-center p-0 text-[14px] leading-none",
                            card.break_even_conflict_flag === "True"
                              ? "text-red-700"
                              : "text-muted-foreground",
                          ].join(" ")}
                          aria-label={breakEvenTooltipMessage(card.break_even_conflict_flag)}
                        >
                          ⓘ
                        </button>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatPercent(card.break_even_first_down_chance)}
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
              );
          })}
          </div>
        </div>
      )}
      {typeof document !== "undefined" && breakEvenTooltip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] w-[220px] -translate-y-full rounded-md border border-border bg-white p-2 text-[11px] leading-snug text-muted-foreground shadow-md"
              style={{ left: `${breakEvenTooltip.x}px`, top: `${breakEvenTooltip.y}px` }}
            >
              <p>The minimum first down chance that favors GO</p>
              {breakEvenTooltip.conflict && (
                <p className="mt-1 text-red-700">
                  Warning: break-even check disagrees with recommended action
                </p>
              )}
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
