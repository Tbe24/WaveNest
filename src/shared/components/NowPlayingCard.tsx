import type { AudioSource, PlaybackState } from '../types';

function formatSeconds(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface NowPlayingCardProps {
  source?: AudioSource;
  playback: PlaybackState;
  isFavorite: boolean;
  compact?: boolean;
  onPlay(): void;
  onPause(): void;
  onStop(): void;
  onPrevious(): void;
  onNext(): void;
  onToggleMute(): void;
  onVolumeChange(volume: number): void;
  onToggleFavorite(): void;
}

export function NowPlayingCard(props: NowPlayingCardProps) {
  const { source, playback, compact = false } = props;
  const isPlaying = playback.status === 'playing';
  const progressLabel =
    source?.type === 'podcast_episode' ? formatSeconds(playback.position || 0) : source?.isLive ? 'Live' : 'Idle';
  const volumePercent = Math.round(playback.volume * 100);

  return (
    <section className={`now-playing ${compact ? 'now-playing--compact' : ''}`}>
      <div className="now-playing__meta">
        <div className="badge-row">
          <span className={`badge ${source?.isLive ? 'badge--live' : 'badge--podcast'}`}>
            {source?.isLive ? 'LIVE' : source ? 'PODCAST' : 'READY'}
          </span>
          <button
            className={`favorite-button ${props.isFavorite ? 'is-favorite' : ''}`}
            onClick={props.onToggleFavorite}
            aria-label={props.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={props.isFavorite}
            title={props.isFavorite ? 'Remove from favorites' : 'Pin to favorites'}
            disabled={!source}
            type="button"
          >
            <span aria-hidden="true">{props.isFavorite ? '♥' : '♡'}</span>
          </button>
        </div>
        <h2 className="now-playing__title">{source?.title ?? 'Pick something to play'}</h2>
        <p className="now-playing__subtitle">
          {source?.subtitle ?? 'Ethiopia-first radio, international stations, and podcasts in one place.'}
        </p>
        <div className="now-playing__status">
          <span>{playback.status.toUpperCase()}</span>
          <span>{progressLabel}</span>
        </div>
      </div>

      <div className="now-playing__controls">
        <div className="transport-controls" aria-label="Playback controls">
          <button className="transport-button" onClick={props.onPrevious} disabled={!source} aria-label="Previous" type="button">
            <span aria-hidden="true">⏮</span><small>Previous</small>
          </button>
          <button
            className="accent-button play-button"
            onClick={isPlaying ? props.onPause : props.onPlay}
            disabled={!source}
            type="button"
          >
            <span aria-hidden="true">{isPlaying ? '⏸' : '▶'}</span>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="transport-button" onClick={props.onNext} disabled={!source} aria-label="Next" type="button">
            <span aria-hidden="true">⏭</span><small>Next</small>
          </button>
        </div>
        {source ? (
          <button className="stop-button" onClick={props.onStop} type="button">
            <span aria-hidden="true">■</span> Stop audio
          </button>
        ) : null}
        <div className="volume-control">
          <span className="volume-control__label">
            <button className="volume-button" onClick={props.onToggleMute} aria-label={playback.muted ? 'Unmute' : 'Mute'} type="button">
              <span aria-hidden="true">{playback.muted || volumePercent === 0 ? '🔇' : volumePercent < 50 ? '🔉' : '🔊'}</span>
              <span>{playback.muted ? 'Muted' : 'Volume'}</span>
            </button>
            <output>{playback.muted ? 0 : volumePercent}%</output>
          </span>
          <div className="volume-control__slider">
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={playback.volume}
              onChange={(event) => props.onVolumeChange(Number(event.target.value))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
