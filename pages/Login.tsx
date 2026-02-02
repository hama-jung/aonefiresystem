import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, User } from 'lucide-react';
import { AuthAPI } from '../services/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // [Fix 1] 이미 로그인된 사용자가 로그인 페이지에 접근하면 대시보드로 리다이렉트
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      // replace: true를 사용하여 뒤로가기 시 다시 로그인 페이지로 오는 것 방지
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pw) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setErrorMessage(''); // 에러 메시지 초기화
    
    try {
      const response: any = await AuthAPI.login(id, pw);
      if (response.success) {
        // 로그인 성공 시 사용자 정보 저장
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        // [Fix 2] 로그인 후 히스토리 스택을 교체(replace)하여 뒤로가기 방지
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      // 로그인 실패 시 에러 메시지 설정
      setErrorMessage('아이디나 비밀번호가 틀립니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center relative overflow-hidden">
      {/* Background decoration (Dark Mode) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/30 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
         <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-900/30 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
         <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-indigo-900/30 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-slate-800 border border-slate-700 p-10 rounded-2xl shadow-2xl w-full max-w-lg z-10 relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#2f3b52] mb-4 shadow-lg border border-slate-600">
            <Activity className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 whitespace-nowrap">AI 화재알림 모니터링 시스템</h1>
          <p className="text-slate-400 font-medium">스마트 IoT 모니터링 시스템 v1.0</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="User ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-lg leading-5 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-lg leading-5 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm"
            />
          </div>

          {/* 에러 메시지 표시 영역 */}
          {errorMessage && (
            <div className="text-red-400 text-sm font-medium text-center animate-pulse">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors transform hover:scale-[1.01] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        
        <p className="mt-8 text-center text-xs text-slate-500">
          Copyright 2026. (주)에이원 소방. all rights reserved.
        </p>
      </div>
    </div>
  );
};