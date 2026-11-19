export function HeroHeader() {
  return (
    <header className="po-hero-head">
      <div className="po-eyebrow">
        <svg className="po-brand-glyph" fill="none" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          <path
            d="M6 .8v2.4M6 8.8v2.4M.8 6h2.4M8.8 6h2.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1"
          />
        </svg>
        <span>PAIRING BENCH</span>
        <span className="po-eyebrow-divider">·</span>
        <span>配伍检测</span>
      </div>
      <div className="po-title-row">
        <h1 className="po-title">能一起用吗？</h1>
      </div>
    </header>
  )
}
