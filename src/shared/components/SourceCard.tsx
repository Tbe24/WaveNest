import type { AudioSource, SourceFailure } from '../types';

function formatDuration(durationSeconds?: number): string {
  if (!durationSeconds) {
    return 'Ready';
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface SourceCardProps {
  source: AudioSource;
  active: boolean;
  isFavorite: boolean;
  failure?: SourceFailure;
  compact?: boolean;
  onSelect(): void;
  onToggleFavorite(): void;
}

export function SourceCard(props: SourceCardProps) {
  const { source, compact = false } = props;
  const marketLabel = source.countryCode === 'ET'
    ? '🇪🇹 Ethiopia'
    : source.countryCode === 'US' || source.tags.includes('market-us')
      ? '🇺🇸 USA'
      : source.countryCode === 'GB' || source.tags.includes('market-gb')
        ? '🇬🇧 UK'
        : source.scope === 'local' ? 'Local' : 'Global';
  const chartLabel = source.tags.includes('us-top') && source.tags.includes('uk-top')
    ? 'US + UK Top'
    : source.tags.includes('us-top')
      ? 'US Top'
      : source.tags.includes('uk-top') ? 'UK Top' : undefined;
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${source.title} ${source.type === 'radio' ? 'live radio' : source.subtitle ?? 'podcast'}`
  )}`;

  return (
    <article className={`source-card ${compact ? 'source-card--compact' : ''} ${props.active ? 'is-active' : ''}`}>
      <div className="source-card__main">
        <div className="badge-row">
          <span className={`badge ${source.isLive ? 'badge--live' : 'badge--podcast'}`}>
            {source.isLive ? 'RADIO' : 'EPISODE'}
          </span>
          <span className="source-card__meta">{marketLabel}</span>
          {chartLabel ? <span className="badge badge--chart">{chartLabel}</span> : null}
        </div>
        <h3>{source.title}</h3>
        <p>{source.subtitle ?? source.description ?? source.category}</p>
        <div className="source-card__foot">
          <span>{source.category.toUpperCase()}</span>
          <span>{source.isLive ? 'Now streaming' : formatDuration(source.durationSeconds)}</span>
        </div>
        {props.failure ? (
          <p className="source-card__failure" role="status">
            <strong>Unavailable:</strong> This stream may be offline or unsupported.
          </p>
        ) : null}
      </div>

      <div className="source-card__actions">
        <button className="accent-button" onClick={props.onSelect} type="button">
          {props.active ? 'Resume' : 'Play'}
        </button>
        <button
          className={`favorite-button favorite-button--labeled ${props.isFavorite ? 'is-favorite' : ''}`}
          onClick={props.onToggleFavorite}
          aria-pressed={props.isFavorite}
          title={props.isFavorite ? 'Remove from favorites' : 'Pin to favorites'}
          type="button"
        >
          <span aria-hidden="true">{props.isFavorite ? '♥' : '♡'}</span>
          {props.isFavorite ? 'Pinned' : 'Favorite'}
        </button>
        <a
          className="ghost-button source-card__youtube"
          href={youtubeSearchUrl}
          target="_blank"
          rel="noreferrer"
          title="Find this source on YouTube"
        >
          YouTube
        </a>
        {source.homepage ? (
          <a
            className="ghost-button source-card__website"
            href={source.homepage}
            target="_blank"
            rel="noreferrer"
            title="Open the official station website"
          >
            Official
          </a>
        ) : null}
      </div>
    </article>
  );
}
