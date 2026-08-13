import type { ContentCategory } from '../types';

const categories: ContentCategory[] = ['music', 'news', 'tech', 'talk', 'podcasts'];
export type BrowseCategory = ContentCategory | 'all' | 'radio';

interface CategoryChipsProps {
  selected: BrowseCategory;
  onSelect(category: BrowseCategory): void;
}

export function CategoryChips(props: CategoryChipsProps) {
  return (
    <div className="chip-row">
      <button
        className={`chip ${props.selected === 'all' ? 'is-selected' : ''}`}
        onClick={() => props.onSelect('all')}
        type="button"
      >
        All
      </button>
      <button
        className={`chip ${props.selected === 'radio' ? 'is-selected' : ''}`}
        onClick={() => props.onSelect('radio')}
        type="button"
      >
        Radio
      </button>
      {categories.map((category) => (
        <button
          key={category}
          className={`chip ${props.selected === category ? 'is-selected' : ''}`}
          onClick={() => props.onSelect(category)}
          type="button"
        >
          {category === 'podcasts' ? 'Podcasts' : category[0].toUpperCase() + category.slice(1)}
        </button>
      ))}
    </div>
  );
}
