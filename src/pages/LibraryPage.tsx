import React, { useEffect, useState } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { OreInput } from '../ui/primitives/OreInput';
import { OreDropdown } from '../ui/primitives/OreDropdown';
import { CollectionSidebar } from '../features/Library/components/CollectionSidebar';
import { LibraryItemCard } from '../features/Library/components/LibraryItemCard';
import { motion } from 'framer-motion';

const LibraryPage: React.FC = () => {
  const { 
    items, 
    collections, 
    initialized, 
    initializeLibrary,
    getItemsInCollection 
  } = useLibraryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');

  useEffect(() => {
    if (!initialized) {
      initializeLibrary();
    }
  }, [initialized, initializeLibrary]);

  // Determine items to display
  const displayedItems = React.useMemo(() => {
    let base = selectedGroupId === 'all' 
      ? items 
      : getItemsInCollection(selectedGroupId);

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      base = base.filter(i => {
        try {
          const snap = JSON.parse(i.snapshot);
          return snap.title.toLowerCase().includes(q) || (snap.author && snap.author.toLowerCase().includes(q));
        } catch {
          return false;
        }
      });
    }
    return base;
  }, [items, selectedGroupId, searchQuery, getItemsInCollection]);

  return (
    <div className="flex h-full w-full flex-col bg-ore-bg-darker overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="flex h-16 w-full shrink-0 items-center justify-between px-6 border-b border-white/5 bg-black/20">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-minecraft text-white drop-shadow-md">库 Library</h1>
          <div className="h-6 w-px bg-white/10" />
          <div className="w-64">
            <OreInput 
              placeholder="搜索所有已收藏资源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefixNode={<span className="text-white/50">🔍</span>}
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <OreDropdown 
            options={[
              { label: '添加整合包', value: 'add_pack' },
              { label: '导入本地Mod', value: 'import_mod' }
            ]}
            value=""
            onChange={() => {}}
            placeholder="📥 获取内容"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 shrink-0 border-r border-white/5 bg-black/10 overflow-y-auto">
          <CollectionSidebar 
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            collections={collections}
          />
        </div>

        {/* Resource Grid */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 relative">
          {!initialized ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/50 animate-pulse font-minecrafttext">Loading Library Data...</span>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
              <span className="text-6xl mb-4">📦</span>
              <p className="font-minecraft text-xl">该库依然空空如也</p>
              <p className="text-sm mt-2 font-sans">尝试探索主页或模组下载板块</p>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 auto-rows-max"
              style={{
                // Responsive grid scaling for up to 4K displays
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
              }}
            >
              {displayedItems.map(item => (
                <LibraryItemCard key={item.id} item={item} />
              ))}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
};

export default LibraryPage;
