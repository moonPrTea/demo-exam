export function toCsv(headers, rows, delimiter = ';') {
  if (![';', ','].includes(delimiter)) throw new Error('Допустимые разделители: ; и ,');
  const cell = value => {
    const text = value == null ? '' : String(value);
    const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return /["\r\n]/.test(safe) || safe.includes(delimiter) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return '\uFEFF' + [headers, ...rows.map(row => headers.map(key => row[key]))]
    .map(row => row.map(cell).join(delimiter)).join('\r\n') + '\r\n';
}
