import { useState, useMemo } from 'react';
import { Search, ArrowDownUp, Check, X, Link as LinkIcon } from 'lucide-react';
import { AssetMapping } from '@/services/assetMappingService';

interface AssetMappingDnDProps {
  asterAssets: string[];
  hlAssets: string[];
  asterPrices: Map<string, number>;
  hlPrices: Map<string, number>;
  mappings: AssetMapping[];
  onAddMapping: (mapping: AssetMapping) => void;
  onRemoveMapping: (canonical: string) => void;
}

export default function AssetMappingDnD({
  asterAssets,
  hlAssets,
  asterPrices,
  hlPrices,
  mappings,
  onAddMapping,
  onRemoveMapping,
}: AssetMappingDnDProps) {
  const [selectedAster, setSelectedAster] = useState<string | null>(null);
  const [selectedHL, setSelectedHL] = useState<string | null>(null);
  const [canonicalName, setCanonicalName] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [asterSearch, setAsterSearch] = useState('');
  const [hlSearch, setHlSearch] = useState('');

  // Separate mapped and unmapped assets
  const mappedAsterSymbols = new Set(mappings.map(m => m.asterSymbol));
  const mappedHLSymbols = new Set(mappings.map(m => m.hyperliquidSymbol));

  const unmappedAster = useMemo(
    () => asterAssets.filter(asset => !mappedAsterSymbols.has(asset)),
    [asterAssets, mappedAsterSymbols]
  );

  const unmappedHL = useMemo(
    () => hlAssets.filter(asset => !mappedHLSymbols.has(asset)),
    [hlAssets, mappedHLSymbols]
  );

  // Filter by search
  const filteredUnmappedAster = unmappedAster.filter(asset =>
    asset.toLowerCase().includes(asterSearch.toLowerCase())
  );

  const filteredUnmappedHL = unmappedHL.filter(asset =>
    asset.toLowerCase().includes(hlSearch.toLowerCase())
  );

  const filteredMappedAster = mappings
    .map(m => m.asterSymbol)
    .filter(asset => asset.toLowerCase().includes(asterSearch.toLowerCase()));

  const filteredMappedHL = mappings
    .map(m => m.hyperliquidSymbol)
    .filter(asset => asset.toLowerCase().includes(hlSearch.toLowerCase()));

  // Format price for display
  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
      return `$${price.toFixed(4)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(6)}`;
    } else {
      return `$${price.toFixed(8)}`;
    }
  };

  // Auto-detect multiplier from price ratio
  const detectMultiplier = (asterSymbol: string, hlSymbol: string): number => {
    const asterPrice = asterPrices.get(asterSymbol);
    const hlPrice = hlPrices.get(hlSymbol);

    if (!asterPrice || !hlPrice || hlPrice === 0) return 1;

    const ratio = asterPrice / hlPrice;

    // Round to nearest power of 10 if close
    if (Math.abs(ratio - 1) < 0.1) return 1;
    if (Math.abs(ratio - 10) < 1) return 10;
    if (Math.abs(ratio - 100) < 10) return 100;
    if (Math.abs(ratio - 1000) < 100) return 1000;
    if (Math.abs(ratio - 10000) < 1000) return 10000;
    if (Math.abs(ratio - 100000) < 10000) return 100000;
    if (Math.abs(ratio - 1000000) < 100000) return 1000000;

    return Math.round(ratio);
  };

  // Auto-suggest canonical name
  const suggestCanonical = (asterSymbol: string, hlSymbol: string) => {
    // Try to extract common base symbol
    const asterBase = asterSymbol.replace(/USDT|USDC|USD|PERP|1000|1000000/gi, '');
    const hlBase = hlSymbol.replace(/USDT|USDC|USD|PERP/gi, '');

    if (asterBase === hlBase) {
      return asterBase;
    }

    // Use shorter one
    return asterBase.length < hlBase.length ? asterBase : hlBase;
  };

  const handleAsterClick = (asset: string) => {
    setSelectedAster(asset);
    if (selectedHL) {
      const suggested = suggestCanonical(asset, selectedHL);
      setCanonicalName(suggested);
      // Auto-detect and set multiplier
      const detectedMultiplier = detectMultiplier(asset, selectedHL);
      setMultiplier(detectedMultiplier);
    }
  };

  const handleHLClick = (asset: string) => {
    setSelectedHL(asset);
    if (selectedAster) {
      const suggested = suggestCanonical(selectedAster, asset);
      setCanonicalName(suggested);
      // Auto-detect and set multiplier
      const detectedMultiplier = detectMultiplier(selectedAster, asset);
      setMultiplier(detectedMultiplier);
    }
  };

  const handleMapAssets = () => {
    if (selectedAster && selectedHL && canonicalName) {
      const newMapping: AssetMapping = {
        canonical: canonicalName,
        asterSymbol: selectedAster,
        hyperliquidSymbol: selectedHL,
        multiplier,
      };

      onAddMapping(newMapping);

      // Reset selection
      setSelectedAster(null);
      setSelectedHL(null);
      setCanonicalName('');
      setMultiplier(1);
    }
  };

  const handleUnmap = (mapping: AssetMapping) => {
    onRemoveMapping(mapping.canonical);
  };

  const renderAssetCard = (
    asset: string,
    isSelected: boolean,
    onClick: () => void,
    color: 'cyan' | 'purple'
  ) => {
    const price = color === 'cyan' ? asterPrices.get(asset) : hlPrices.get(asset);
    const baseClasses = 'px-3 py-2 rounded-lg text-sm font-mono cursor-pointer transition-all';
    const colorClasses = color === 'cyan'
      ? 'bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30'
      : 'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30';
    const selectedClasses = isSelected
      ? color === 'cyan'
        ? 'ring-2 ring-cyan-400 bg-cyan-500/30'
        : 'ring-2 ring-purple-400 bg-purple-500/30'
      : '';

    return (
      <div
        key={asset}
        onClick={onClick}
        className={`${baseClasses} ${colorClasses} ${selectedClasses}`}
      >
        <div className="font-semibold">{asset}</div>
        {price !== undefined && (
          <div className="text-xs text-gray-400 mt-0.5">{formatPrice(price)}</div>
        )}
      </div>
    );
  };

  const renderMappedCard = (mapping: AssetMapping, side: 'aster' | 'hl') => {
    const asset = side === 'aster' ? mapping.asterSymbol : mapping.hyperliquidSymbol;
    const color = side === 'aster' ? 'cyan' : 'purple';
    const baseClasses = 'px-3 py-2 rounded-lg text-sm font-mono opacity-50 transition-all flex items-center justify-between';
    const colorClasses = color === 'cyan'
      ? 'bg-cyan-500/5 border border-cyan-500/20'
      : 'bg-purple-500/5 border border-purple-500/20';

    return (
      <div key={asset} className={`${baseClasses} ${colorClasses}`}>
        <div className="flex items-center gap-2">
          <Check className="h-3 w-3 text-green-400" />
          <span>{asset}</span>
        </div>
        <button
          onClick={() => handleUnmap(mapping)}
          className="opacity-0 hover:opacity-100 transition-opacity"
          title="Unmap"
        >
          <X className="h-3 w-3 text-red-400" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <LinkIcon className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-yellow-400 mb-1">Drag & Drop Asset Mapping</h4>
            <p className="text-xs text-gray-300">
              Click assets on both sides to select them, then confirm the mapping. Mapped assets will be grayed out and moved to the bottom.
            </p>
          </div>
        </div>
      </div>

      {/* Main Mapping Area */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-6">
        {/* AsterDEX Column */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-cyan-500/20">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              AsterDEX Assets
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={asterSearch}
                onChange={(e) => setAsterSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Unmapped Assets */}
            {filteredUnmappedAster.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                  Unmapped ({filteredUnmappedAster.length})
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredUnmappedAster.map((asset) =>
                    renderAssetCard(
                      asset,
                      selectedAster === asset,
                      () => handleAsterClick(asset),
                      'cyan'
                    )
                  )}
                </div>
              </div>
            )}

            {/* Mapped Assets */}
            {filteredMappedAster.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400" />
                  Mapped ({filteredMappedAster.length})
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {mappings
                    .filter(m => filteredMappedAster.includes(m.asterSymbol))
                    .map((mapping) => renderMappedCard(mapping, 'aster'))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center - Mapping Preview */}
        <div className="flex items-center justify-center px-4">
          {selectedAster && selectedHL ? (
            <div className="bg-slate-800/50 border border-yellow-500/30 rounded-lg p-6 min-w-[300px]">
              <div className="text-center mb-4">
                {/* Asset Pair with Prices */}
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="text-center">
                      <div className="text-cyan-400 font-mono text-sm font-semibold">{selectedAster}</div>
                      <div className="text-cyan-400/60 text-xs">
                        {asterPrices.get(selectedAster) !== undefined && formatPrice(asterPrices.get(selectedAster)!)}
                      </div>
                    </div>
                    <ArrowDownUp className="h-4 w-4 text-yellow-400 mx-2" />
                    <div className="text-center">
                      <div className="text-purple-400 font-mono text-sm font-semibold">{selectedHL}</div>
                      <div className="text-purple-400/60 text-xs">
                        {hlPrices.get(selectedHL) !== undefined && formatPrice(hlPrices.get(selectedHL)!)}
                      </div>
                    </div>
                  </div>

                  {/* Price Ratio Display */}
                  {(() => {
                    const asterPrice = asterPrices.get(selectedAster);
                    const hlPrice = hlPrices.get(selectedHL);
                    if (asterPrice && hlPrice && hlPrice !== 0) {
                      const ratio = asterPrice / hlPrice;
                      const detectedMultiplier = detectMultiplier(selectedAster, selectedHL);
                      const isGoodMatch = Math.abs(ratio - multiplier) < multiplier * 0.15;

                      return (
                        <div className={`text-xs px-3 py-2 rounded-lg ${
                          isGoodMatch
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          <div className="font-semibold">Price Ratio: {ratio.toFixed(2)}x</div>
                          {!isGoodMatch && (
                            <div className="text-xs mt-1">
                              ⚠️ Suggested: {detectedMultiplier}x
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Canonical Symbol
                    </label>
                    <input
                      type="text"
                      value={canonicalName}
                      onChange={(e) => setCanonicalName(e.target.value.toUpperCase())}
                      placeholder="BTC"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Multiplier
                    </label>
                    <input
                      type="number"
                      value={multiplier}
                      onChange={(e) => setMultiplier(Number(e.target.value))}
                      min="1"
                      step="1"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>

                  <button
                    onClick={handleMapAssets}
                    disabled={!canonicalName}
                    className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg text-sm font-bold hover:from-yellow-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Map These Assets
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm">
              <ArrowDownUp className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>Select assets from both sides</p>
              <p className="text-xs mt-1">to create a mapping</p>
            </div>
          )}
        </div>

        {/* HyperLiquid Column */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-purple-500/20">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              HyperLiquid Assets
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={hlSearch}
                onChange={(e) => setHlSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Unmapped Assets */}
            {filteredUnmappedHL.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                  Unmapped ({filteredUnmappedHL.length})
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredUnmappedHL.map((asset) =>
                    renderAssetCard(
                      asset,
                      selectedHL === asset,
                      () => handleHLClick(asset),
                      'purple'
                    )
                  )}
                </div>
              </div>
            )}

            {/* Mapped Assets */}
            {filteredMappedHL.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400" />
                  Mapped ({filteredMappedHL.length})
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {mappings
                    .filter(m => filteredMappedHL.includes(m.hyperliquidSymbol))
                    .map((mapping) => renderMappedCard(mapping, 'hl'))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">{mappings.length}</div>
            <div className="text-xs text-gray-400 uppercase">Mapped Pairs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-cyan-400">{unmappedAster.length}</div>
            <div className="text-xs text-gray-400 uppercase">Aster Unmapped</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">{unmappedHL.length}</div>
            <div className="text-xs text-gray-400 uppercase">HL Unmapped</div>
          </div>
        </div>
      </div>
    </div>
  );
}
