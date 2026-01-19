import { createClient } from '@supabase/supabase-js';

// 에이원 소방 화재감지 시스템 Supabase 설정
const SUPABASE_URL = 'https://eslzbdgoibrllajabrah.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbHpiZGdvaWJybGxhamFicmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NjIwNTAsImV4cCI6MjA4NDMzODA1MH0.fV8urGmu2yox0BtMbngcE-GTAfd6WIWk_xxqp29gB0o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);