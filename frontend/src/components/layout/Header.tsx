'use client';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">ReachInbox</h1>
          <div>{/* TODO(lld): Add UserMenu component */}</div>
        </div>
      </div>
    </header>
  );
}
