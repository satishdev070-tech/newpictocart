/** Ensure seeded catalogue titles are labelled as samples for the merchant. */
export function withSamplePrefix(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "Sample Product";
  if (trimmed.startsWith("Sample ")) return trimmed;
  return `Sample ${trimmed}`;
}
