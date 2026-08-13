import type { MarketFilter } from '../types';

interface MarketToggleProps {
  value: MarketFilter;
  onChange(market: MarketFilter): void;
}

const markets: Array<{ value: MarketFilter; label: string }> = [
  { value: 'all', label: 'All regions' },
  { value: 'ET', label: '🇪🇹 Ethiopia' },
  { value: 'US', label: '🇺🇸 USA' },
  { value: 'GB', label: '🇬🇧 UK' }
];

export function MarketToggle(props: MarketToggleProps) {
  return (
    <div className="market-row" role="group" aria-label="Region filter">
      {markets.map((market) => (
        <button
          key={market.value}
          className={`market-button ${props.value === market.value ? 'is-selected' : ''}`}
          onClick={() => props.onChange(market.value)}
          aria-pressed={props.value === market.value}
          type="button"
        >
          {market.label}
        </button>
      ))}
    </div>
  );
}
