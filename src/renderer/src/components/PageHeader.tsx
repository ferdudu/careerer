export function PageHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }): JSX.Element {
  return (
    <header className="page-head">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="display">{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </header>
  )
}
