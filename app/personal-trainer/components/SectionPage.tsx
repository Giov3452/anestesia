export function SectionPage({ eyebrow, title, description, emptyTitle, emptyDescription }: {
  eyebrow: string; title: string; description: string; emptyTitle: string; emptyDescription: string;
}) {
  return (
    <div className="pt-page">
      <p className="pt-eyebrow" style={{ margin: 0 }}>{eyebrow}</p>
      <h2>{title}</h2>
      <p className="pt-muted">{description}</p>
      <div className="pt-section"><div className="pt-empty"><strong style={{ color: "#294a3a" }}>{emptyTitle}</strong><p style={{ marginBottom: 0 }}>{emptyDescription}</p></div></div>
    </div>
  );
}
