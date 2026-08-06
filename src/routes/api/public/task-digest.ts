import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/api/public/task-digest')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // 1. Verify internal secret to prevent public abuse
        const authHeader = request.headers.get('Authorization')
        const internalSecret = process.env.INTERNAL_API_SECRET
        
        if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        try {
          // 1. Get all managers/admins who should receive the digest
          const { data: managers, error: userError } = await supabase
            .from('user_roles')
            .select('user_id, profiles(email, full_name)')
            .eq('role', 'admin');
            
          if (userError) throw userError;
          
          // 2. For each manager, fetch overdue and upcoming tasks
          const results = [];
          for (const manager of (managers as any[])) {
            const email = manager.profiles?.email;
            if (!email) continue;
            
            const now = new Date().toISOString();
            const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            
            // Get overdue tasks
            const { data: overdue } = await supabase
              .from('tasks')
              .select('title, due_date, status')
              .lt('due_date', now)
              .not('status', 'in', '("completed","done","cancelled","approved")');
              
            // Get upcoming tasks
            const { data: upcoming } = await supabase
              .from('tasks')
              .select('title, due_date, status')
              .gte('due_date', now)
              .lte('due_date', nextWeek)
              .not('status', 'in', '("completed","done","cancelled","approved")');
              
            if ((overdue?.length ?? 0) > 0 || (upcoming?.length ?? 0) > 0) {
              // Mock sending email
              console.log(`[TaskDigest] Weekly digest prepared for ${email}: ${overdue?.length} overdue, ${upcoming?.length} upcoming tasks.`);
              results.push({ email, overdue: overdue?.length, upcoming: upcoming?.length });
            }
          }
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Weekly digests processed', 
            sent_to: results 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
