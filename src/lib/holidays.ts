/** 指定年の日本の祝日を "YYYY-MM-DD" の Set で返す */
function computeYear(year: number): Set<string> {
  const set = new Set<string>()

  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

  const add = (y: number, m: number, d: number) => set.add(iso(y, m, d))
  const has = (y: number, m: number, d: number) => set.has(iso(y, m, d))
  const dow = (y: number, m: number, d: number) => new Date(y, m - 1, d).getDay()

  // n 番目の曜日 (weekday: 0=日…6=土)
  const nthWeekday = (y: number, m: number, weekday: number, n: number): number => {
    let d = 1
    while (new Date(y, m - 1, d).getDay() !== weekday) d++
    return d + (n - 1) * 7
  }

  // 春分・秋分 (1980-2099 の近似式)
  const vernal   = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
  const autumnal = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))

  // ── 固定祝日 ──
  add(year,  1,  1)   // 元日
  add(year,  2, 11)   // 建国記念の日
  add(year,  2, 23)   // 天皇誕生日 (2020-)
  add(year,  3, vernal)  // 春分の日
  add(year,  4, 29)   // 昭和の日
  add(year,  5,  3)   // 憲法記念日
  add(year,  5,  4)   // みどりの日
  add(year,  5,  5)   // こどもの日
  add(year,  8, 11)   // 山の日
  add(year,  9, autumnal)  // 秋分の日
  add(year, 11,  3)   // 文化の日
  add(year, 11, 23)   // 勤労感謝の日

  // ── ハッピーマンデー ──
  add(year,  1, nthWeekday(year,  1, 1, 2))  // 成人の日 (1月第2月曜)
  add(year,  7, nthWeekday(year,  7, 1, 3))  // 海の日   (7月第3月曜)
  add(year,  9, nthWeekday(year,  9, 1, 3))  // 敬老の日 (9月第3月曜)
  add(year, 10, nthWeekday(year, 10, 1, 2))  // スポーツの日 (10月第2月曜)

  // ── 国民の祝日: 前後が祝日に挟まれた平日 ──
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate()
    for (let d = 2; d < daysInMonth; d++) {
      if (dow(year, m, d) === 0) continue  // 日曜はスキップ
      if (has(year, m, d)) continue
      if (has(year, m, d - 1) && has(year, m, d + 1)) add(year, m, d)
    }
  }

  // ── 振替休日: 祝日が日曜 → 翌月曜(連休なら翌々日…) ──
  const snapshot = [...set].sort()
  for (const h of snapshot) {
    const [y, m, d] = h.split("-").map(Number)
    if (dow(y, m, d) !== 0) continue  // 日曜でなければスキップ
    let cY = y, cM = m, cD = d + 1
    const norm = () => {
      const dt = new Date(cY, cM - 1, cD)
      cY = dt.getFullYear(); cM = dt.getMonth() + 1; cD = dt.getDate()
    }
    norm()
    while (set.has(iso(cY, cM, cD)) || dow(cY, cM, cD) === 0) {
      cD++; norm()
    }
    add(cY, cM, cD)
  }

  return set
}

// 年ごとのキャッシュ
const cache = new Map<number, Set<string>>()

function holidaysForYear(year: number): Set<string> {
  if (!cache.has(year)) cache.set(year, computeYear(year))
  return cache.get(year)!
}

/** dates 配列から、祝日にあたるインデックスの Set を返す */
export function computeHolidayCols(dates: Date[]): Set<number> {
  const result = new Set<number>()
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    const year = d.getFullYear()
    const key  = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (holidaysForYear(year).has(key)) result.add(i)
  }
  return result
}
