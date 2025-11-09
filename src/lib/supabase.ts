import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://alagzqcmkfuqidxbniav.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsYWd6cWNta2Z1cWlkeGJuaWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzQ5MzYsImV4cCI6MjA3ODI1MDkzNn0.lkQROKWsRqfE35PAjE7Hz-a6ShhT03i84ZYe2h43q6Q';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
