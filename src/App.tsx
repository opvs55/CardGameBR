import { useState } from 'react';
import { AlbumScreen } from './features/album/AlbumScreen';
import { BattleScreen } from './features/battle/BattleScreen';
import { useBattle } from './features/battle/store';
import { HomeScreen } from './features/home/HomeScreen';

type Screen = 'home' | 'battle' | 'album';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const start = useBattle((s) => s.start);
  const quit = useBattle((s) => s.quit);

  if (screen === 'battle')
    return (
      <BattleScreen
        onExit={() => {
          quit();
          setScreen('home');
        }}
      />
    );
  if (screen === 'album') return <AlbumScreen onBack={() => setScreen('home')} />;
  return (
    <HomeScreen
      onPlay={(deck) => {
        start(deck);
        setScreen('battle');
      }}
      onAlbum={() => setScreen('album')}
    />
  );
}
