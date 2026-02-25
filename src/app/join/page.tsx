import { Suspense } from 'react';
import JoinClient from './JoinClient';

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <JoinClient />
    </Suspense>
  );
}


