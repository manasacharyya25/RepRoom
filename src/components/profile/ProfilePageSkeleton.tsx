export function ProfilePageSkeleton() {
  return (
    <div className="profile-page profile-page--skeleton" aria-busy="true">
      <section className="profile-hero">
        <aside className="profile-identity">
          <div className="profile-skeleton-block profile-skeleton-avatar" />
          <div className="profile-skeleton-block profile-skeleton-line" />
          <div className="profile-skeleton-block profile-skeleton-line profile-skeleton-line--short" />
          <div className="profile-skeleton-block profile-skeleton-line profile-skeleton-line--medium" />
        </aside>
        <div className="profile-skeleton-panel">
          <div className="profile-skeleton-block profile-skeleton-line" />
          <div className="profile-skeleton-block profile-skeleton-line profile-skeleton-line--medium" />
          <div className="profile-skeleton-grid">
            <div className="profile-skeleton-block profile-skeleton-card" />
            <div className="profile-skeleton-block profile-skeleton-card" />
            <div className="profile-skeleton-block profile-skeleton-card" />
          </div>
        </div>
      </section>
      <div className="app-route-loading app-route-loading--inline" role="status">
        <div className="app-route-loading-spinner" aria-hidden="true" />
        <p>Loading profile…</p>
      </div>
    </div>
  );
}
