import type { AudioSource, SourceFailure } from '../types';
import { SourceCard } from './SourceCard';

interface SourceSectionProps {
  title: string;
  items: AudioSource[];
  currentSourceId?: string;
  favorites: string[];
  failures: Record<string, SourceFailure>;
  compact?: boolean;
  onSelect(source: AudioSource, queueIds: string[]): void;
  onToggleFavorite(sourceId: string): void;
}

export function SourceSection(props: SourceSectionProps) {
  if (props.items.length === 0) {
    return null;
  }

  const queueIds = props.items.map((item) => item.id);

  return (
    <section className="section-block">
      <div className="section-block__header">
        <h2>{props.title}</h2>
        <span>{props.items.length}</span>
      </div>
      <div className={`source-grid ${props.compact ? 'source-grid--compact' : ''}`}>
        {props.items.map((item) => (
          <SourceCard
            key={item.id}
            source={item}
            active={item.id === props.currentSourceId}
            isFavorite={props.favorites.includes(item.id)}
            failure={props.failures[item.id]}
            compact={props.compact}
            onSelect={() => props.onSelect(item, queueIds)}
            onToggleFavorite={() => props.onToggleFavorite(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
