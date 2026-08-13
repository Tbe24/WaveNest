import type { SourceFailure } from '../types';

interface FailurePanelProps {
  failures: Record<string, SourceFailure>;
  onClear(sourceId: string): void;
}

export function FailurePanel(props: FailurePanelProps) {
  const entries = Object.entries(props.failures)
    .sort((left, right) => right[1].occurredAt.localeCompare(left[1].occurredAt))
    .slice(0, 4);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="section-block">
      <div className="section-block__header">
        <h2>Source Health</h2>
        <span>{entries.length}</span>
      </div>
      <div className="failure-list">
        {entries.map(([sourceId, failure]) => (
          <article key={sourceId} className="failure-item">
            <div>
              <h3>{failure.sourceId ?? 'General'}</h3>
              <p>{failure.message}</p>
            </div>
            <button className="ghost-button" onClick={() => props.onClear(sourceId)} type="button">
              Clear
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
