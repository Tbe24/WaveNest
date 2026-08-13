import type { ScopeFilter } from '../types';

interface ScopeToggleProps {
  value: ScopeFilter;
  onChange(scopeFilter: ScopeFilter): void;
}

export function ScopeToggle(props: ScopeToggleProps) {
  const options: Array<{ value: ScopeFilter; label: string; hint: string }> = [
    { value: 'all', label: 'All', hint: 'Everything' },
    { value: 'local', label: 'Local', hint: 'Ethiopia' },
    { value: 'english', label: 'English', hint: 'English audio' }
  ];

  return (
    <div className="toggle-group" role="tablist" aria-label="Scope filter">
      {options.map((option) => (
        <button
          key={option.value}
          className={`toggle-group__button ${props.value === option.value ? 'is-selected' : ''}`}
          onClick={() => props.onChange(option.value)}
          aria-selected={props.value === option.value}
          type="button"
        >
          <strong>{option.label}</strong>
          <small>{option.hint}</small>
        </button>
      ))}
    </div>
  );
}
