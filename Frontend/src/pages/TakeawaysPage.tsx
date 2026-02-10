import { useEffect, useMemo, useState } from "react";
import { loadCsv } from "../lib/csv";
import { buildDataUrl } from "../lib/dataSource";

type SummaryRow = {
  scope: string;
  pass_attempts: string;
  interceptions: string;
  expected_ints: string;
  expected_minus_actual: string;
};

type PerGameRow = {
  game_id: string;
  week: string;
  opponent: string;
  home_away: string;
  pass_attempts: string;
  pass_defenses: string;
  qb_hits: string;
  sacks: string;
  interceptions: string;
  expected_ints: string;
  expected_minus_actual: string;
  opp_avg_ints_per_game: string;
  opp_avg_expected_ints_per_game: string;
};

type DriveDetailRow = {
  game_id: string;
  qtr: string;
  time: string;
  pass_attempts: string;
  pass_defenses: string;
  qb_hits: string;
  sacks: string;
  interceptions: string;
  expected_ints: string;
};

type PlayDetailRow = {
  game_id: string;
  qtr: string;
  time: string;
  pass_defense: string;
  qb_hit: string;
  sack: string;
  interception: string;
  expected_int_prob: string;
  desc: string;
};

type DetailTab = "drive" | "play";

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

function getLogo(abbrev: string) {
  return teamLogoMap[abbrev?.toUpperCase()] ?? null;
}

function fmt(value: string | number, digits = 2) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  return num.toFixed(digits);
}

function fmtPct(value: string | number) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  return `${(num * 100).toFixed(1)}%`;
}

function fmtSign(value: string | number) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}`;
}

function fmtIntOrDash(value: string | number) {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return "--";
  return `${Math.trunc(num)}`;
}

function fmtFixedOrDash(value: string | number, digits = 2) {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return "--";
  return num.toFixed(digits);
}

function fmtLeaguePerTeamNoDecimals(value: string | number) {
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  return `${Math.round(num / 32)}`;
}

export default function TakeawaysPage() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [perGame, setPerGame] = useState<PerGameRow[]>([]);
  const [driveDetail, setDriveDetail] = useState<DriveDetailRow[]>([]);
  const [playDetail, setPlayDetail] = useState<PlayDetailRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("drive");

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setError(null);
        const [summaryRows, perGameRows, driveRows, playRows] = await Promise.all([
          loadCsv<SummaryRow>(buildDataUrl("nyj_2025_int_summary.csv")),
          loadCsv<PerGameRow>(buildDataUrl("nyj_2025_int_per_game.csv")),
          loadCsv<DriveDetailRow>(buildDataUrl("nyj_2025_int_drive_detail.csv")),
          loadCsv<PlayDetailRow>(buildDataUrl("nyj_2025_int_play_detail.csv")),
        ]);
        if (!mounted) return;
        setSummary(summaryRows);
        setPerGame(perGameRows);
        setDriveDetail(driveRows);
        setPlayDetail(playRows);
      } catch {
        if (!mounted) return;
        setError("INT data not found in Frontend/public/data.");
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const jetsSummary = useMemo(
    () => summary.find((row) => row.scope === "NYJ 2025"),
    [summary]
  );
  const leagueAvgSummary = useMemo(
    () => summary.find((row) => row.scope === "League 2025 Avg Team"),
    [summary]
  );

  const rowsWithBye = useMemo(() => {
    const byWeek = new Map<number, PerGameRow>();
    for (const row of perGame) {
      const week = Number(row.week);
      if (!Number.isNaN(week)) byWeek.set(week, row);
    }
    return Array.from({ length: 18 }, (_, i) => {
      const week = i + 1;
      const row = byWeek.get(week) ?? null;
      return { week, row, isBye: row === null };
    });
  }, [perGame]);

  const activeDriveRows = useMemo(() => {
    if (!expandedGameId) return [];
    return driveDetail.filter((row) => row.game_id === expandedGameId);
  }, [driveDetail, expandedGameId]);

  const activePlayRows = useMemo(() => {
    if (!expandedGameId) return [];
    return playDetail.filter((row) => row.game_id === expandedGameId);
  }, [playDetail, expandedGameId]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Takeaway Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Evaluate interception opportunities and outcomes across the 2025 season
        </p>
      </div>

      <div className="mx-auto w-full max-w-[1320px] space-y-4 px-0">
        {error ? (
          <div className="rounded-2xl border border-border bg-white px-4 py-6 text-sm text-muted-foreground shadow-sm">
            {error}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[hsl(160_66%_21%/.15)] bg-[hsl(160_66%_21%/.08)] px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual INTs</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold text-foreground">{fmt(jetsSummary?.interceptions ?? "--", 0)}</p>
                <p className="text-xs text-foreground/70">
                  League Avg: {fmtLeaguePerTeamNoDecimals(leagueAvgSummary?.interceptions ?? "--")}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(160_66%_21%/.22)] bg-[hsl(160_66%_21%/.14)] px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected INTs</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold text-foreground">{fmt(jetsSummary?.expected_ints ?? "--", 2)}</p>
                <p className="text-xs text-foreground/70">
                  League Avg: {fmtLeaguePerTeamNoDecimals(leagueAvgSummary?.expected_ints ?? "--")}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/30 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-[9.09%] px-2 py-2">Week</th>
                    <th className="w-[9.09%] px-2 py-2">Opponent</th>
                    <th className="w-[9.09%] px-2 py-2">Pass Att</th>
                    <th className="w-[9.09%] px-2 py-2">Pass Def</th>
                    <th className="w-[9.09%] px-2 py-2">QB Hits</th>
                    <th className="w-[9.09%] px-2 py-2">Sacks</th>
                    <th className="w-[9.09%] px-2 py-2">Opp Avg INTs</th>
                    <th className="w-[9.09%] px-2 py-2">Opp Avg Exp INTs</th>
                    <th className="w-[9.09%] px-2 py-2">JETS INT</th>
                    <th className="w-[9.09%] px-2 py-2">JETS EXPECTED INT</th>
                    <th className="w-[9.09%] px-2 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithBye.map(({ week, row, isBye }, idx) => {
                    const rowKey = row?.game_id ?? `bye-${week}`;
                    const isExpanded = expandedGameId === row?.game_id;
                    return (
                      <>
                        <tr key={rowKey} className="h-14 border-t border-border">
                          <td
                            className={[
                              "px-2 py-2 text-center font-medium",
                              isBye ? "bg-muted/20" : "",
                            ].join(" ")}
                          >
                            {week}
                          </td>
                          <td className={["px-2 py-2 text-center", isBye ? "bg-muted/20 text-muted-foreground" : ""].join(" ")}>
                            {isBye ? (
                              "BYE"
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                {getLogo(row!.opponent) ? (
                                  <img src={getLogo(row!.opponent) as string} alt={row!.opponent} className="h-7 w-7 object-contain" />
                                ) : null}
                                <span>{row!.home_away === "away" ? `@${row!.opponent}` : row!.opponent}</span>
                              </div>
                            )}
                          </td>
                          <td className={["px-2 py-2 text-center", isBye ? "bg-muted/20 text-muted-foreground" : ""].join(" ")}>{isBye ? "--" : fmtIntOrDash(row!.pass_attempts)}</td>
                          <td className={["px-2 py-2 text-center", isBye ? "bg-muted/20 text-muted-foreground" : ""].join(" ")}>{isBye ? "--" : fmtIntOrDash(row!.pass_defenses)}</td>
                          <td className={["px-2 py-2 text-center", isBye ? "bg-muted/20 text-muted-foreground" : ""].join(" ")}>{isBye ? "--" : fmtIntOrDash(row!.qb_hits)}</td>
                          <td className={["px-2 py-2 text-center", isBye ? "bg-muted/20 text-muted-foreground" : ""].join(" ")}>{isBye ? "--" : fmtIntOrDash(row!.sacks)}</td>
                          <td
                            className={[
                              "px-2 py-2 text-center",
                              isBye ? "text-muted-foreground" : "",
                              idx % 2 === 0 ? "bg-muted/20" : "bg-muted/35",
                            ].join(" ")}
                          >
                            {isBye ? "--" : fmtFixedOrDash(row!.opp_avg_ints_per_game)}
                          </td>
                          <td
                            className={[
                              "px-2 py-2 text-center",
                              isBye ? "text-muted-foreground" : "",
                              idx % 2 === 0 ? "bg-muted/20" : "bg-muted/35",
                            ].join(" ")}
                          >
                            {isBye ? "--" : fmtFixedOrDash(row!.opp_avg_expected_ints_per_game)}
                          </td>
                          <td
                            className={[
                              "px-2 py-2 text-center font-semibold",
                              isBye ? "text-muted-foreground" : "",
                              idx % 2 === 0
                                ? "bg-[hsl(160_66%_21%/.08)]"
                                : "bg-[hsl(160_66%_21%/.14)]",
                            ].join(" ")}
                          >
                            {isBye ? "--" : fmtIntOrDash(row!.interceptions)}
                          </td>
                          <td
                            className={[
                              "px-2 py-2 text-center font-semibold",
                              isBye ? "text-muted-foreground" : "",
                              idx % 2 === 0
                                ? "bg-[hsl(160_66%_21%/.08)]"
                                : "bg-[hsl(160_66%_21%/.14)]",
                            ].join(" ")}
                          >
                            {isBye ? "--" : fmtFixedOrDash(row!.expected_ints)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {isBye ? (
                              <span className="inline-flex min-w-[52px] items-center justify-center rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                                --
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedGameId(null);
                                  } else {
                                    setExpandedGameId(row!.game_id);
                                    setDetailTab("drive");
                                  }
                                }}
                                className="rounded-full border border-border bg-white px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                              >
                                {isExpanded ? "Hide" : "View"}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr key={`${rowKey}-detail`} className="border-t border-border bg-muted/10">
                            <td colSpan={11} className="px-4 py-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDetailTab("drive")}
                                    className={[
                                      "rounded-full border px-3 py-1 text-xs font-semibold",
                                      detailTab === "drive"
                                        ? "border-transparent bg-primary text-primary-foreground"
                                        : "border-border bg-white text-foreground/80",
                                    ].join(" ")}
                                  >
                                    By Drive
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDetailTab("play")}
                                    className={[
                                      "rounded-full border px-3 py-1 text-xs font-semibold",
                                      detailTab === "play"
                                        ? "border-transparent bg-primary text-primary-foreground"
                                        : "border-border bg-white text-foreground/80",
                                    ].join(" ")}
                                  >
                                    By Play
                                  </button>
                                </div>
                                {detailTab === "drive" ? (
                                  <div className="space-y-1">
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-[620px] table-fixed text-xs">
                                        <thead className="text-center text-muted-foreground">
                                          <tr>
                                            <th className="px-2 py-2">Qtr</th>
                                            <th className="px-2 py-2">Time</th>
                                            <th className="px-2 py-2">Pass Att</th>
                                            <th className="px-2 py-2">Pass Def*</th>
                                            <th className="px-2 py-2">QB Hits</th>
                                            <th className="px-2 py-2">Sacks</th>
                                            <th className="px-2 py-2">INTs</th>
                                            <th className="px-2 py-2 text-center">Expected INTs**</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {activeDriveRows.map((d, idx) => (
                                            <tr
                                              key={`${d.qtr}-${d.time}-${idx}`}
                                              className={[
                                                "border-t border-border",
                                                idx % 2 === 1 ? "bg-[hsl(160_66%_21%/.08)]" : "",
                                                idx === activeDriveRows.length - 1
                                                  ? "border-b border-b-black"
                                                  : "",
                                              ].join(" ")}
                                            >
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(d.qtr)}</td>
                                              <td className="px-2 py-2 text-center">{d.time}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(d.pass_attempts)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(d.pass_defenses)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(d.qb_hits)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(d.sacks)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(d.interceptions)}</td>
                                              <td className="px-2 py-2 text-center">{fmtFixedOrDash(d.expected_ints)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                                      * Pass breakups/deflections, as credited by official charting
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      ** Sum of play-by-play interception probabilities across this drive
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-[760px] text-xs">
                                        <thead className="text-center text-muted-foreground">
                                          <tr>
                                          <th className="px-2 py-2">Qtr</th>
                                          <th className="px-2 py-2">Time</th>
                                          <th className="px-2 py-2">PDef*</th>
                                          <th className="px-2 py-2">Hit</th>
                                          <th className="px-2 py-2">Sack</th>
                                          <th className="px-2 py-2">INT</th>
                                          <th className="px-2 py-2 text-center">Exp INT Prob**</th>
                                          <th className="px-2 py-2 text-left">Description</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {activePlayRows.map((p, idx) => (
                                            <tr
                                              key={`${p.time}-${idx}`}
                                              className={[
                                                "border-t border-border",
                                                idx % 2 === 1 ? "bg-[hsl(160_66%_21%/.08)]" : "",
                                                idx === activePlayRows.length - 1
                                                  ? "border-b border-b-black"
                                                  : "",
                                              ].join(" ")}
                                            >
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(p.qtr)}</td>
                                              <td className="px-2 py-2 text-center">{p.time}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(p.pass_defense)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(p.qb_hit)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(p.sack)}</td>
                                              <td className="px-2 py-2 text-center">{fmtIntOrDash(p.interception)}</td>
                                              <td className="px-2 py-2 text-center">{Number(p.expected_int_prob) === 0 ? "--" : fmtPct(p.expected_int_prob)}</td>
                                              <td className="px-2 py-2 text-left">{p.desc}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                                      * Pass breakups/deflections, as credited by official charting
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      ** Model-estimated interception probability per play
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
