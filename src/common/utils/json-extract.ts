export function extractFirstJson(text: string): any | null {
  if (!text || typeof text !== 'string') return null;
  text = text.trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    // try to locate first { or [ and last matching }
    const firstBrace = Math.min(
      ...['{', '[']
        .map((c) => {
          const idx = text.indexOf(c);
          return idx === -1 ? Infinity : idx;
        })
        .filter((v) => v !== Infinity)
    );
    if (!isFinite(firstBrace)) return null;
    // find last closing brace
    const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (lastBrace <= firstBrace) return null;
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (e2) {
      return null;
    }
  }
}

export default extractFirstJson;
