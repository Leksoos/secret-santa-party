import React, { useState } from 'react';
import { X, Save, Sparkles, Ban, Heart, Plus, Trash2, Link, Tag, Check, Shirt } from 'lucide-react';
import { Participant, WishlistItem } from '../types';
import { sound } from '../lib/sound';
import { triggerHaptic } from '../lib/tg';

interface ProfileModalProps {
  participant: Participant;
  roomCode: string;
  onClose: () => void;
  onSaved: (updated: Participant) => void;
}

const AVATARS = ['🎅', '🤶', '⛄', '🎄', '🦌', '🎁', '🐻', '🦊', '🐧', '🦉', '🍪', '🥂'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PRESET_HOBBIES = [
  'IT 💻',
  'Гейминг 🎮',
  'Спорт 🏂',
  'Книги 📚',
  'Кофе ☕',
  'Кулинария 🍳',
  'Путешествия ✈️',
  'Котики 🐱',
  'Творчество 🎨',
  'Музыка 🎧',
  'Настолки 🎲',
  'Кино 🍿',
];

const PRESET_ANTI_TAGS = [
  'Свечи',
  'Носки',
  'Блокноты',
  'Кружки',
  'Сладкое',
  'Статуэтки / Сувениры',
  'Косметика',
  'Гели для душа',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  participant,
  roomCode,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(participant.name);
  const [avatar, setAvatar] = useState(participant.avatar);
  const [clothingSize, setClothingSize] = useState(participant.clothingSize || '');
  const [hobbies, setHobbies] = useState<string[]>(participant.hobbies || []);
  
  // Structured Wishlist Items
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(
    participant.wishlistItems && participant.wishlistItems.length > 0
      ? participant.wishlistItems
      : []
  );
  const [wishlistText, setWishlistText] = useState(participant.wishlist || '');

  // Anti-Wishlist tags & free text
  const [antiTags, setAntiTags] = useState<string[]>(participant.antiWishlistTags || []);
  const [antiWishlistText, setAntiWishlistText] = useState(participant.antiWishlist || '');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Toggle hobby tag
  const toggleHobby = (hobby: string) => {
    triggerHaptic('light');
    setHobbies((prev) =>
      prev.includes(hobby) ? prev.filter((h) => h !== hobby) : [...prev, hobby]
    );
  };

  // Toggle anti-tag
  const toggleAntiTag = (tag: string) => {
    triggerHaptic('light');
    setAntiTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Add Wishlist item
  const handleAddItem = () => {
    triggerHaptic('light');
    const newItem: WishlistItem = {
      id: `item-${Date.now()}`,
      title: '',
      url: '',
      price: '',
    };
    setWishlistItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof WishlistItem, value: string) => {
    setWishlistItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    triggerHaptic('light');
    setWishlistItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    triggerHaptic('medium');

    const cleanItems = wishlistItems.filter((it) => it.title.trim() !== '');

    try {
      const res = await fetch(
        `/api/rooms/${roomCode}/participants/${participant.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            avatar,
            clothingSize,
            hobbies,
            wishlist: wishlistText.trim(),
            wishlistItems: cleanItems,
            antiWishlist: antiWishlistText.trim(),
            antiWishlistTags: antiTags,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');

      sound.play('pop');
      setSavedSuccess(true);
      onSaved(data.participant);
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-3xl shadow-inner">
            {avatar}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-festive">
              Мой профиль и пожелания
            </h3>
            <p className="text-xs text-slate-400">
              🔒 Вишлист засекречен: его увидит только ваш выпавший Санта!
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Name, Avatar & Size */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Имя
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-white text-sm outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Shirt className="w-3.5 h-3.5 text-amber-400" />
                  <span>Размер одежды (если актуально)</span>
                </label>
                <div className="flex gap-1.5 overflow-x-auto py-0.5">
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setClothingSize(clothingSize === sz ? '' : sz)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        clothingSize === sz
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Выберите аватар
              </label>
              <div className="flex gap-1.5 overflow-x-auto py-1">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition shrink-0 ${
                      avatar === av
                        ? 'bg-red-600 scale-105 ring-2 ring-white/50'
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Hobbies / Interests */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-400" />
              <span>Мои интересы и хобби (видны в лобби)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_HOBBIES.map((hobby) => {
                const active = hobbies.includes(hobby);
                return (
                  <button
                    key={hobby}
                    type="button"
                    onClick={() => toggleHobby(hobby)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      active
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {hobby}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Structured Wishlist Items */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                <span>Конкретные хотелки (Вишлист)</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-lg transition font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить пункт</span>
              </button>
            </div>

            {/* List of items */}
            <div className="space-y-2 mb-3">
              {wishlistItems.map((it) => (
                <div
                  key={it.id}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Название подарка (напр: Книга Дюна)..."
                    value={it.title}
                    onChange={(e) => handleUpdateItem(it.id, 'title', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg text-white outline-none w-full"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="url"
                      placeholder="Ссылка (Ozon/WB)..."
                      value={it.url || ''}
                      onChange={(e) => handleUpdateItem(it.id, 'url', e.target.value)}
                      className="w-32 bg-slate-950 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Цена..."
                      value={it.price || ''}
                      onChange={(e) => handleUpdateItem(it.id, 'price', e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-700 text-xs px-2 py-1.5 rounded-lg text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* General text */}
            <textarea
              rows={2}
              value={wishlistText}
              onChange={(e) => setWishlistText(e.target.value)}
              placeholder="Дополнительные пожелания свободным текстом (предпочтения, хобби, цвета)..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white text-xs placeholder-slate-600 outline-none transition resize-none leading-relaxed"
            />
          </div>

          {/* Section 4: Anti-Wishlist (Stop-List) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <label className="block text-[11px] font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              <span>Стоп-лист: Что точно НЕ дарить</span>
            </label>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_ANTI_TAGS.map((tag) => {
                const active = antiTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleAntiTag(tag)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
                      active
                        ? 'bg-red-950 text-red-300 border border-red-700 shadow'
                        : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span>🚫</span>
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              rows={2}
              value={antiWishlistText}
              onChange={(e) => setAntiWishlistText(e.target.value)}
              placeholder="Аллергии, непереносимость, что у вас уже есть и точно не нужно..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-red-500 rounded-xl p-2.5 text-white text-xs placeholder-slate-600 outline-none transition resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3.5 font-bold rounded-xl text-white transition flex items-center justify-center gap-2 text-sm shadow-xl ${
              savedSuccess
                ? 'bg-emerald-600'
                : 'bg-red-600 hover:bg-red-500 shadow-red-950/40'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Сохранено!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{saving ? 'Сохраняем...' : 'Сохранить анкету Санты'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
