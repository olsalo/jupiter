// Keep the desktop preview visible before Vite applies the app stylesheet
const previewStyles = `
  .auth-preview { display: none }
  @media (min-width: 768px) {
    body:has(.auth-layout) { margin: 0 }
    .auth-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      min-height: 100dvh;
    }
    .auth-preview {
      display: flex;
      padding-bottom: var(--tappable-inset-bottom, 0px);
    }
    .auth-preview-image {
      min-width: 0;
      flex: 1;
      border-left: 1px solid var(--border, #e5e5e5);
      background-color: var(--color-neutral-100, #f5f5f5);
      background-image: url('/mockup-light.avif');
      background-size: min(90%, calc(90dvh * 4551 / 3968)) auto;
      background-position: right bottom -24px;
      background-repeat: no-repeat;
    }
    .dark .auth-preview-image {
      background-color: var(--color-neutral-900, #171717);
      background-image: url('/mockup-dark.avif');
    }
  }
`

export function AuthPreview() {
  return (
    <>
      <style>{previewStyles}</style>
      <section aria-hidden={true} className="auth-preview">
        <div className="auth-preview-image" />
      </section>
    </>
  )
}
