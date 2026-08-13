import type { BrowseCategory } from './CategoryChips';

export type SubcategoryFilter = 'all' | string;

const optionsByCategory: Partial<Record<BrowseCategory, Array<{ value: string; label: string }>>> = {
  music: [
    { value: 'pop', label: 'Pop & Hits' },
    { value: 'hip-hop', label: 'Hip-Hop & Rap' },
    { value: 'reggae', label: 'Reggae' },
    { value: 'rock', label: 'Rock' },
    { value: 'electronic', label: 'Electronic' },
    { value: 'jazz', label: 'Jazz' },
    { value: 'country', label: 'Country' },
    { value: 'classical', label: 'Classical' }
  ],
  tech: [
    { value: 'ai', label: 'AI' },
    { value: 'software', label: 'Software' },
    { value: 'web-dev', label: 'Web Development' },
    { value: 'gadgets', label: 'Gadgets' },
    { value: 'startups', label: 'Startups' },
    { value: 'science', label: 'Science' }
  ],
  news: [
    { value: 'world-news', label: 'World' },
    { value: 'politics', label: 'Politics' },
    { value: 'business', label: 'Business' },
    { value: 'local-news', label: 'Local' }
  ],
  talk: [
    { value: 'comedy', label: 'Comedy' },
    { value: 'interviews', label: 'Interviews' },
    { value: 'sports', label: 'Sports' },
    { value: 'history', label: 'History' },
    { value: 'education', label: 'Education' }
  ]
};

interface SubcategoryChipsProps {
  category: BrowseCategory;
  selected: SubcategoryFilter;
  onSelect(value: SubcategoryFilter): void;
}

export function SubcategoryChips(props: SubcategoryChipsProps) {
  const options = optionsByCategory[props.category] ?? [];
  if (options.length === 0) return null;

  return (
    <div className="subcategory-block">
      <span>More specific</span>
      <div className="chip-row" role="group" aria-label={`${props.category} subcategory filter`}>
        <button className={`chip ${props.selected === 'all' ? 'is-selected' : ''}`} onClick={() => props.onSelect('all')} aria-pressed={props.selected === 'all'} type="button">
          All {props.category}
        </button>
        {options.map((option) => (
          <button key={option.value} className={`chip ${props.selected === option.value ? 'is-selected' : ''}`} onClick={() => props.onSelect(option.value)} aria-pressed={props.selected === option.value} type="button">
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
