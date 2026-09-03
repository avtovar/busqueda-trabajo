const TABS = [
  { region: 'argentina', label: '🇦🇷 Argentina' },
  { region: 'mexico', label: '🇲🇽 México' },
  { region: 'peru', label: '🇵🇪 Perú' },
  { region: 'colombia', label: '🇨🇴 Colombia' },
  { region: 'chile', label: '🇨🇱 Chile' },
  { region: 'europa', label: '🇪🇺 Europa' },
  { region: 'eeuu', label: '🇺🇸 Estados Unidos' },
];

export default function RegionTabs({ current, onSelect }) {
  return (
    <div className="region-tabs">
      {TABS.map((t) => (
        <button
          key={t.region}
          className={`region-tab${current === t.region ? ' active' : ''}`}
          onClick={() => onSelect(t.region)}
        >
          {t.label}
        </button>
      ))}
      <button
        className={`region-tab consultoras-tab${current === 'consultoras' ? ' active' : ''}`}
        onClick={() => onSelect('consultoras')}
      >
        🏢 Consultoras QA
      </button>
    </div>
  );
}
