interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-[#e6ece8]">
      <nav className="-mb-px flex gap-7" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === tab.id
                  ? 'border-[#5cc79b] text-[#2c9b71]'
                  : 'border-transparent text-[#8a948e] hover:text-[#202522] hover:border-[#cfdad4]'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
