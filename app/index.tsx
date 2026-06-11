import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { SplashScreen } from '../components/screens/SplashScreen';
import { StartScreen } from '../components/screens/StartScreen';

type EntryStage = 'splash' | 'start';

// Prototype-only entry flow. There is no real auth here yet; the action enters
// the local app for portfolio/demo purposes.
export default function EntryRoute() {
  const router = useRouter();
  const [stage, setStage] = useState<EntryStage>('splash');

  const showStart = useCallback(() => {
    setStage('start');
  }, []);

  const startFocusing = useCallback(() => {
    router.replace('/session');
  }, [router]);

  if (stage === 'splash') {
    return <SplashScreen onDone={showStart} />;
  }

  return <StartScreen onStartFocusing={startFocusing} />;
}
