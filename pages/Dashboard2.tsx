import React from 'react';
import { PageHeader } from '../components/CommonUI';

export const Dashboard2: React.FC = () => {
  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드2" />
      
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-800 rounded-lg border border-slate-700 m-4 p-10 opacity-80">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-2xl font-bold text-slate-300 mb-2">준비 중입니다</h2>
        <p className="text-slate-500">새로운 대시보드 화면이 곧 구성될 예정입니다.</p>
      </div>
    </div>
  );
};