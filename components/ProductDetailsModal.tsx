
import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { generateProductDetails } from '../services/geminiService';

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, brand?: string, price?: number) => void;
  onUpdateDetails?: (id: string, details: Partial<Product>) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ product, onClose, onAdd, onUpdateDetails }) => {
  const [details, setDetails] = useState<Partial<Product>>({
    description: product.description,
    ingredients: product.ingredients,
    nutrition: product.nutrition
  });
  
  const [loading, setLoading] = useState(!product.description || !product.ingredients || !product.nutrition);
  const [quantity, setQuantity] = useState(1);
  const [selectedBrandIndex, setSelectedBrandIndex] = useState(0);

  const brands = product.brands || [{name: 'Generic', price: product.price, imageUrl: product.imageUrl}];
  const currentBrand = brands[selectedBrandIndex];
  const currentPrice = currentBrand.price;
  const currentBrandName = currentBrand.name;
  
  const displayMrp = product.brands && product.brands.length > 0 
      ? currentPrice * 1.2 
      : (product.mrp || product.price);

  const discount = displayMrp > currentPrice 
      ? Math.round(((displayMrp - currentPrice) / displayMrp) * 100) 
      : 0;

  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      if (!product.description || !product.ingredients || !product.nutrition) {
        setLoading(true);
        try {
          const generated = await generateProductDetails(product.name);
          if (isMounted) {
            setDetails(generated);
            setLoading(false);
            if (onUpdateDetails) onUpdateDetails(product.id, generated);
          }
        } catch (error) {
          if (isMounted) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [product, onUpdateDetails]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] overflow-y-auto hide-scrollbar">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-brand-light to-white -z-10"></div>
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/50 backdrop-blur rounded-full text-slate-500 hover:bg-white hover:text-slate-800 transition-all z-20 shadow-sm">✕</button>

        <div className="flex flex-col items-center pt-4">
          <div className="w-48 h-48 bg-white rounded-[2.5rem] flex items-center justify-center shadow-soft-xl mb-6 animate-bounce-soft border-4 border-white relative overflow-hidden">
            <div className="text-[6.5rem] emoji-3d">{product.emoji}</div>
            {discount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-black px-3 py-1.5 rounded-full shadow-lg rotate-12">
                    {discount}% OFF
                </div>
            )}
          </div>

          <h2 className="text-4xl font-black text-slate-900 text-center tracking-tight leading-none mb-2">{product.name}</h2>
          
          <div className="flex items-baseline gap-3">
              {discount > 0 && <span className="text-xl text-slate-400 line-through font-bold">₹{Math.round(displayMrp)}</span>}
              <p className="text-4xl font-black text-brand-DEFAULT">₹{currentPrice}</p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
           {loading ? (
              <div className="text-center py-8 opacity-50 space-y-3">
                 <div className="animate-spin text-3xl">✨</div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulting AI Chef...</p>
              </div>
           ) : (
              <div className="animate-fade-in space-y-6">
                  <p className="text-center text-slate-600 font-medium leading-relaxed px-4 text-lg">{details.description}</p>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Ingredients</span>
                          <span className="text-sm font-bold text-slate-800 leading-snug block">{details.ingredients}</span>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Nutrition</span>
                          <span className="text-sm font-bold text-slate-800 leading-snug block">{details.nutrition}</span>
                      </div>
                  </div>
              </div>
           )}
        </div>

        <div className="mt-10 flex items-center gap-4">
             <div className="flex items-center gap-4 bg-slate-100 rounded-2xl px-4 py-3 shadow-inner">
                 <button onClick={() => setQuantity(q => Math.max(1, q-1))} className="w-8 h-8 bg-white rounded-xl shadow-sm text-lg font-bold text-slate-600 flex items-center justify-center">-</button>
                 <span className="text-xl font-black text-slate-800 w-6 text-center">{quantity}</span>
                 <button onClick={() => setQuantity(q => q+1)} className="w-8 h-8 bg-white rounded-xl shadow-sm text-lg font-bold text-slate-600 flex items-center justify-center">+</button>
             </div>
             <button onClick={() => { onAdd(product, quantity, currentBrandName, currentPrice); onClose(); }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2 uppercase text-[10px] tracking-widest">Add to Cart</button>
        </div>
      </div>
    </div>
  );
};
