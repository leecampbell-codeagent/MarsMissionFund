import { type ReactElement, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePublicCampaigns } from '../../../hooks/campaign/use-public-campaigns';
import { PublicCampaignCard } from '../../../components/campaign/public-campaign-card/PublicCampaignCard';
import { CampaignSearchBar } from '../../../components/campaign/campaign-search-bar/CampaignSearchBar';
import { CategoryFilter } from '../../../components/campaign/category-filter/CategoryFilter';
import { CategoryStatsBar } from '../../../components/campaign/category-stats-bar/CategoryStatsBar';
import { type PublicCampaignSearchParams } from '../../../types/campaign';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'most_funded', label: 'Most Funded' },
  { value: 'least_funded', label: 'Least Funded' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'funded', label: 'Funded' },
  { value: 'ending_soon', label: 'Ending Soon' },
];

const DEFAULT_LIMIT = 20;
const DEBOUNCE_MS = 300;

/**
 * CampaignDiscoveryPage — /campaigns
 * Public discovery page for browsing live and funded Mars mission campaigns.
 * No authentication required.
 * All filter/sort/pagination state stored in URL search params.
 */
export default function CampaignDiscoveryPage(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  // Controlled local value for the search input (debounced before URL write)
  const [localSearch, setLocalSearch] = useState<string>(searchParams.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync URL → local on mount / external navigation
  useEffect(() => {
    setLocalSearch(searchParams.get('q') ?? '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce: write to URL after 300ms of no typing
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) {
          next.set('q', value.trim());
        } else {
          next.delete('q');
        }
        next.delete('offset'); // reset pagination on new search
        return next;
      });
    }, DEBOUNCE_MS);
  };

  // Category filter (multi-value)
  const selectedCategories = searchParams.getAll('category');

  const handleCategoryChange = (categories: string[]) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('category');
      categories.forEach((c) => next.append('category', c));
      next.delete('offset');
      return next;
    });
  };

  // Status filter
  const selectedStatus = searchParams.get('status') ?? '';

  const handleStatusChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('status', value);
      } else {
        next.delete('status');
      }
      next.delete('offset');
      return next;
    });
  };

  // Sort control
  const selectedSort = searchParams.get('sort') ?? 'newest';

  const handleSortChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sort', value);
      return next;
    });
  };

  // Pagination
  const currentOffset = parseInt(searchParams.get('offset') ?? '0', 10);

  const handleLoadMore = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('offset', String(currentOffset + DEFAULT_LIMIT));
      return next;
    });
  };

  // Build query params
  const queryParams: PublicCampaignSearchParams = {
    ...(searchParams.get('q') ? { q: searchParams.get('q')! } : {}),
    ...(selectedCategories.length > 0 ? { category: selectedCategories } : {}),
    ...(selectedStatus ? { status: selectedStatus as PublicCampaignSearchParams['status'] } : {}),
    sort: selectedSort as PublicCampaignSearchParams['sort'],
    limit: DEFAULT_LIMIT,
    offset: currentOffset,
  };

  const { data, isLoading, isError } = usePublicCampaigns(queryParams);

  // Single category for stats bar
  const singleCategory = selectedCategories.length === 1 ? selectedCategories[0] : null;

  const total = data?.pagination.total ?? 0;
  const campaigns = data?.data ?? [];
  const hasMore = currentOffset + DEFAULT_LIMIT < total;

  return (
    <div
      style={{
        background: 'var(--color-bg-page)',
        minHeight: '100vh',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Page header */}
        <header style={{ marginBottom: '40px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-text-accent)',
              margin: '0 0 8px',
            }}
          >
            Explore Missions
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '56px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 12px',
              lineHeight: 1.05,
            }}
          >
            Find Your Mission
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Browse live Mars mission campaigns
          </p>
        </header>

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {/* Search */}
          <CampaignSearchBar value={localSearch} onChange={handleSearchChange} />

          {/* Category filter */}
          <CategoryFilter selected={selectedCategories} onChange={handleCategoryChange} />

          {/* Status + sort row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status filter */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selectedStatus === opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-badge)',
                    border:
                      selectedStatus === opt.value
                        ? '1px solid var(--color-action-primary)'
                        : '1px solid var(--color-border-input)',
                    background:
                      selectedStatus === opt.value
                        ? 'var(--color-status-active-bg)'
                        : 'var(--color-bg-input)',
                    color:
                      selectedStatus === opt.value
                        ? 'var(--color-action-primary)'
                        : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort select */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor="sort-select"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Sort by
              </label>
              <select
                id="sort-select"
                aria-label="Sort campaigns"
                value={selectedSort}
                onChange={(e) => handleSortChange(e.target.value)}
                style={{
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border-input)',
                  borderRadius: 'var(--radius-input)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  padding: '6px 10px',
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category stats bar — shown only when one category is selected */}
        {singleCategory && (
          <div style={{ marginBottom: '24px' }}>
            <CategoryStatsBar category={singleCategory} />
          </div>
        )}

        {/* Result count */}
        {!isLoading && !isError && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              margin: '0 0 20px',
            }}
          >
            {total} {total === 1 ? 'campaign' : 'campaigns'} found
          </p>
        )}

        {/* Loading state */}
        {isLoading && (
          <div
            role="status"
            aria-label="Loading campaigns"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '340px',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  opacity: 0.5,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div
            role="alert"
            style={{
              background:
                'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                color: 'var(--color-status-error)',
                margin: 0,
              }}
            >
              Unable to load campaigns. Please try again.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && campaigns.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 24px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                textTransform: 'uppercase',
                color: 'var(--color-text-primary)',
                margin: '0 0 12px',
              }}
            >
              No Missions Found
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              No campaigns found matching your search. Try adjusting your filters.
            </p>
          </div>
        )}

        {/* Campaign grid */}
        {!isLoading && !isError && campaigns.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px',
              }}
            >
              {campaigns.map((campaign) => (
                <PublicCampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  style={{
                    background: 'var(--gradient-action-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-button)',
                    color: 'var(--color-action-primary-text)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '12px 32px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px var(--color-action-primary-shadow)',
                  }}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
