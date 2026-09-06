import { Calculator } from '@/app/_components/calculator';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="sr-only">나의 적금 금리 계산기</h1>
      <Calculator />
    </main>
  );
}
