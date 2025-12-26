
import React from 'react';
import { Product } from '../types';

interface StickerProductProps {
  product: Product;
  onAdd: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onClick: (product: Product) => void;
  count: number;
}

export const StickerProduct: React.FC<StickerProductProps> = ({ product, onAdd, onClick, count }) => {
  const mrp = product.mrp || product.price;
  const discount = mrp > product.price ? Math.round(((mrp - product.price) / mrp) * 100) : 0;

  return (
    <div 
      className={`group relative bg-white rounded-[2.5rem] p-4 flex flex-col shadow-card transition-all duration-300 hover:shadow-card-hover cursor-pointer overflow-hidden border border-transparent ${count > 0 ? 'ring-2 ring-brand-DEFAULT ring-offset-2' : ''}`}
      onClick={() => onClick(product)}
    >
      {discount > 0 && (
        <div className="absolute top-0 left-0 bg-brand-DEFAULT text-white text-[9px] font-black px-3 py-1 rounded-br-2xl z-20 shadow-sm">
          {discount}% OFF
        </div>
      )}

      <div className="relative aspect-square mb-4 rounded-[2rem] bg-slate-50 flex items-center justify-center group-hover:bg-brand-light/30 transition-colors overflow-hidden">
        <div className="text-6xl transform transition-all duration-500 emoji-3d group-hover:scale-110">
          {product.emoji}
        </div>
        
        {count > 0 && (
          <div className="absolute top-3 right-3 bg-brand-DEFAULT text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow-lg animate-scale-in z-20 border-2 border-white">
            {count}
          </div>
        )}
      </div>
      
      <div className="flex-1 flex flex-col">
        <h3 className="font-black text-slate-800 text-sm leading-tight line-clamp-2 mb-1 group-hover:text-brand-dark transition-colors">{product.name}</h3>
        
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex flex-col leading-none">
             {discount > 0 && <span className="text-[9px] text-slate-400 line-through font-bold mb-0.5">₹{mrp}</span>}
             <span className="font-black text-slate-900 text-base">₹{product.price}</span>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
            className="w-10 h-10 rounded-2xl bg-slate-900 text-white hover:bg-brand-DEFAULT transition-all flex items-center justify-center shadow-lg active:scale-90"
          >
            <span className="text-xl font-black">+</span>
          </button>
        </div>
      </div>
    </div>
  );
};
