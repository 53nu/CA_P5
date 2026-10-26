// Counts are UN annual estimates/projections integrated over actual UTC years.
// They are never presented as individual events received from a live registry.
export function yearSeconds(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 1000;
}

export function ratesAt(timestamp, years) {
  const year = new Date(timestamp).getUTCFullYear();
  const keys = Object.keys(years).map(Number).sort((a,b) => a-b);
  const sourceYear = keys.reduce((best, key) => Math.abs(key-year) < Math.abs(best-year) ? key : best, keys[0]);
  const values = years[String(sourceYear)];
  const seconds = yearSeconds(year);
  return { births: values.births / seconds, deaths: values.deaths / seconds, year, sourceYear };
}

export function integratedCounts(start, now, years) {
  let births = 0, deaths = 0, cursor = start;
  while (cursor < now) {
    const rates = ratesAt(cursor, years);
    const end = Math.min(now, Date.UTC(rates.year + 1, 0, 1));
    const seconds = (end - cursor) / 1000;
    births += seconds * rates.births;
    deaths += seconds * rates.deaths;
    cursor = end;
  }
  return { births: Math.floor(births + 1e-9), deaths: Math.floor(deaths + 1e-9) };
}
