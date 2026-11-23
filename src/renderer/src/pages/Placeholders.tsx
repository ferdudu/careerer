import { PageHeader } from '../components/PageHeader'

export function Placeholder({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }): JSX.Element {
  return (
    <div className="page">
      <PageHeader eyebrow={eyebrow} title={title} lead={text} />
    </div>
  )
}
