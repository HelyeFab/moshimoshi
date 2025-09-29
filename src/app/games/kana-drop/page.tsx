'use client';

import KanaDropGame from './components/KanaDropGame';
import { useRouter } from 'next/navigation';

export default function KanaDropPage() {
  const router = useRouter();

  const handleClose = () => {
    router.push('/games');
  };

  return <KanaDropGame onClose={handleClose} />;
}